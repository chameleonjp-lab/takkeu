"""Additional fixed-field diagnostic; never replaces rallyFlashAnalysis's gate.

Import its unchanged channel conversion and transition detectors. Count EVERY
closing frame above the SAME 25% area in EACH fixed reference-window position.
No temporal clustering, tolerance, threshold adjustment or component merging.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import sys
import unittest

import numpy as np
from PIL import Image

from rallyFlashAnalysis import TurningDetector, channels


def all_window_areas(mask, width, height):
    shape = (mask.shape[0] - height + 1, mask.shape[1] - width + 1)
    if not np.any(mask):
        return np.zeros(shape, dtype=np.int32)
    integral = np.pad(mask.astype(np.int32), ((1, 0), (1, 0)))
    integral = integral.cumsum(0, dtype=np.int32).cumsum(1, dtype=np.int32)
    return (integral[height:, width:] - integral[:-height, width:]
            - integral[height:, :-width] + integral[:-height, :-width])


class FixedFields:
    def __init__(self, shape, fps):
        self.window = fps + 1
        self.ring = np.zeros((self.window, *shape), dtype=np.uint8)
        self.counts = np.zeros(shape, dtype=np.uint16)
        self.global_events = []
        self.max_global = 0
        self.witness = {'count': 0, 'windowXY': None, 'endFrame': None,
                        'closingFrames': [], 'globalClosingFramesInSameSecond': []}

    def advance(self, events, frame):
        slot = frame % self.window
        self.counts -= self.ring[slot]
        self.ring[slot] = events
        self.counts += events
        self.global_events.append(bool(np.any(events)))
        start = max(0, frame - self.window + 1)
        global_frames = [i for i in range(start, frame + 1) if self.global_events[i]]
        self.max_global = max(self.max_global, len(global_frames))
        peak = int(self.counts.max())
        if peak > self.witness['count']:
            y, x = np.unravel_index(int(np.argmax(self.counts)), self.counts.shape)
            self.witness = {
                'count': peak, 'windowXY': [int(x), int(y)], 'endFrame': frame,
                'closingFrames': [i for i in range(start, frame + 1)
                                  if self.ring[i % self.window, y, x]],
                'globalClosingFramesInSameSecond': global_frames,
            }


def diagnose(frames, fps=60, progress=False):
    iterator = iter(frames)
    first = next(iterator)
    height, width = first.shape[:2]
    bw = min(width, math.ceil(width * 341 / 1024))
    bh = min(height, math.ceil(height * 256 / 768))
    area_limit = bw * bh * .25
    shape = (height - bh + 1, width - bw + 1)
    initial = channels(first)
    general = TurningDetector(initial)
    red_u = TurningDetector(initial, True, 0)
    red_v = TurningDetector(initial, True, 1)
    tracks = {'general': FixedFields(shape, fps), 'red': FixedFields(shape, fps)}
    digest = hashlib.sha256()
    count = 0

    def process(rgb, frame):
        digest.update(rgb.tobytes())
        data = initial if frame == 0 else channels(rgb)
        zero = np.zeros((height, width), dtype=bool)
        masks = {'general': zero if frame == 0 else general.advance(data),
                 'red': zero if frame == 0 else red_u.advance(data) | red_v.advance(data)}
        for name, mask in masks.items():
            tracks[name].advance(all_window_areas(mask, bw, bh) > area_limit, frame)

    process(first, 0)
    count = 1
    for frame, rgb in enumerate(iterator, 1):
        if rgb.shape != first.shape:
            raise ValueError('Frame dimensions changed')
        process(rgb, frame)
        count += 1
        if progress and count % 60 == 0:
            print(f'  {count} frames', file=sys.stderr, flush=True)
    return {
        'diagnosticOnly': True, 'frames': count, 'fps': fps,
        'width': width, 'height': height, 'referenceWindow': [bw, bh],
        'areaThreshold25Percent': area_limit, 'inclusiveOneSecondSamples': fps + 1,
        'sourcePixelRGB24SHA256': digest.hexdigest(),
        'general': {**tracks['general'].witness,
                    'maxGlobalAnyWindowClosingFrameCount': tracks['general'].max_global},
        'red': {**tracks['red'].witness,
                'maxGlobalAnyWindowClosingFrameCount': tracks['red'].max_global},
        'fixedFieldClosingFrameFlag': any(t.witness['count'] > 3 for t in tracks.values()),
        'method': 'Every frame with >25% closing-mask area, at every fixed window position; exact integral sums; inclusive fps+1 frame rolling counts. No grouping.',
        'citation': {
            'url': 'https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html',
            'quote': 'the combined area of flashes occurring concurrently occupies no more than a total of .006 steradians within any 10 degree visual field on the screen (25% of any 10 degree visual field on the screen) at typical viewing distance',
            'referenceWindowQuote': 'For general software or web content, using a 341 x 256 pixel rectangle anywhere on the displayed screen area when the content is viewed at 1024 x 768 pixels will provide a good estimate of a 10 degree visual field',
        },
        'limitations': [
            'Diagnostic only: original primary analyzer and its flags remain authoritative recorded results.',
            'Uses original turning-detector closing instants; it does not establish the temporal extent or component identity of a flash.',
            'A fixed-field count <=3 is not a standalone proof of WCAG frequency/area compliance; retain per-pixel high-frequency area and other original metrics.',
            'Fixed viewport field; eye movement, physical viewing distance, HDR and hardware behavior are not modeled.',
            '60Hz SDR/sRGB canvas sampling excludes CSS and is not accredited PEAT/Harding certification.',
        ],
    }


class FixedFieldTests(unittest.TestCase):
    @staticmethod
    def sequence(patches, half_period=15):
        for frame in range(180):
            image = np.zeros((48, 64, 3), dtype=np.uint8)
            for x, y, w, h, delay in patches:
                t = frame - delay
                if t >= 0 and (t // half_period) % 2:
                    image[y:y+h, x:x+w] = 255
            yield image

    def test_distant_two_hz_patches_do_not_mix_fixed_fields(self):
        result = diagnose(self.sequence([(0, 0, 10, 12, 0), (54, 36, 10, 12, 7)]))
        self.assertLessEqual(result['general']['count'], 3)
        self.assertGreater(result['general']['maxGlobalAnyWindowClosingFrameCount'], 3)
        self.assertFalse(result['fixedFieldClosingFrameFlag'])

    def test_six_hz_same_patch_remains_flagged(self):
        result = diagnose(self.sequence([(0, 0, 10, 12, 0)], half_period=5))
        self.assertGreater(result['general']['count'], 3)
        self.assertTrue(result['fixedFieldClosingFrameFlag'])

    def test_four_large_patches_inside_one_field_remain_flagged(self):
        result = diagnose(self.sequence([(0, 0, 12, 8, 0), (10, 0, 12, 8, 2),
                                         (0, 8, 12, 8, 4), (10, 8, 12, 8, 6)]))
        self.assertGreater(result['general']['count'], 3)
        self.assertTrue(result['fixedFieldClosingFrameFlag'])

    def test_integral_areas_equal_every_brute_force_window(self):
        mask = (np.arange(63).reshape(7, 9) % 3) == 0
        actual = all_window_areas(mask, 4, 3)
        expected = np.array([[mask[y:y+3, x:x+4].sum() for x in range(6)] for y in range(5)])
        np.testing.assert_array_equal(actual, expected)


def analyze_directory(directory, output):
    metadata = json.loads((directory / 'capture.json').read_text())
    paths = sorted(directory.glob('[0-9][0-9][0-9][0-9].png'))
    if len(paths) != metadata['frames']:
        raise ValueError(f'Incomplete raw frames: {len(paths)} != {metadata["frames"]}')
    frames = (np.asarray(Image.open(p).convert('RGB')) for p in paths)
    result = diagnose(frames, metadata['fps'], progress=True)
    original = json.loads((directory / 'analysis.json').read_text())
    result['sourceDirectory'] = str(directory)
    result['originalAnalyzerSHA256'] = hashlib.sha256(Path(__file__).with_name('rallyFlashAnalysis.py').read_bytes()).hexdigest()
    result['originalRecordedMetrics'] = {k: original[k] for k in [
        'flagged', 'maxGeneralHighFrequencyArea', 'maxRedHighFrequencyArea',
        'maxGeneralLargeClosingFramesPerSecond', 'maxRedLargeClosingFramesPerSecond']}
    result['originalPixelHashMatches'] = result['sourcePixelRGB24SHA256'] == original['sourcePixelRGB24SHA256']
    result['originalGlobalCountersMatch'] = (
        result['general']['maxGlobalAnyWindowClosingFrameCount'] == original['maxGeneralLargeClosingFramesPerSecond']
        and result['red']['maxGlobalAnyWindowClosingFrameCount'] == original['maxRedLargeClosingFramesPerSecond'])
    if not result['originalPixelHashMatches'] or not result['originalGlobalCountersMatch']:
        raise ValueError('Pixel hash or original global counter mismatch')
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'output': str(output), 'general': result['general'], 'red': result['red'],
                      'fixedFieldClosingFrameFlag': result['fixedFieldClosingFrameFlag']}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directories', nargs='*', type=Path)
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--output-directory', type=Path)
    args = parser.parse_args()
    if args.self_test:
        unittest.main(argv=['rallyFixedFieldAnalysis'], exit=True)
    elif args.directories and args.output_directory:
        args.output_directory.mkdir(parents=True, exist_ok=True)
        for directory in args.directories:
            analyze_directory(directory, args.output_directory / f'fixed-field-{directory.name}.json')
    else:
        parser.error('Use --self-test, or directories with --output-directory')
