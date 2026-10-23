"""Derive viewport visibility and static pixel-area measures from raw evidence.

Usage: python3 tests/helpers/viewportEvidenceAnalysis.py <evidence-directory>
Requires the execution environment's Pillow. It does not modify screenshots or
raw geometry evidence. Pixel thresholds describe static image coverage only;
they are not a flashing-safety test or a segmentation of physical glow.
"""
import gzip
import json
import math
import pathlib
import sys

from PIL import Image


directory = pathlib.Path(sys.argv[1])
manifest = json.loads((directory / "manifest.json").read_text())
records = []
sources = {}


def viewport_margin(bounds, rect, viewport):
    return min(
        rect["left"] + bounds["left"],
        viewport["width"] - rect["left"] - bounds["right"],
        rect["top"] + bounds["top"],
        viewport["height"] - rect["top"] - bounds["bottom"],
    )


def linear(channel):
    value = channel / 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


linear_channels = [linear(i) for i in range(256)]


def luminance(pixel):
    return 0.2126 * linear_channels[pixel[0]] + 0.7152 * linear_channels[pixel[1]] + 0.0722 * linear_channels[pixel[2]]


for item in manifest["records"]:
    with gzip.open(directory / item["json"], "rt") as stream:
        raw = json.load(stream)
    viewport, rect = raw["viewport"], raw["canvas"]["rect"]
    image = Image.open(directory / f'{item["id"]}-viewport.png').convert("RGB")
    canvas_image = Image.open(directory / f'{item["id"]}-canvas.png').convert("RGB")
    if image.size != (viewport["width"], viewport["height"]):
        raise ValueError(f'Viewport image size does not match recorded viewport: {item["id"]}')
    key = (item["engine"], viewport["width"], viewport["height"])
    if item["state"]["score"] == 0:
        sources[key] = canvas_image
    compare = sources[key] if item["state"]["score"] == 555 else None
    # Pixel centres must lie within the visible CSS canvas.
    x0 = max(0, math.ceil(rect["left"] - 0.5))
    y0 = max(0, math.ceil(rect["top"] - 0.5))
    x1 = min(viewport["width"], math.ceil(rect["right"] - 0.5))
    y1 = min(viewport["height"], math.ceil(rect["bottom"] - 0.5))
    visible_pixels = max(0, x1 - x0) * max(0, y1 - y0)
    high_luminance = bright_saturated = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            pixel = image.getpixel((x, y))
            high_luminance += luminance(pixel) >= 0.5
            high = max(pixel)
            bright_saturated += high >= 192 and (high - min(pixel)) / max(1, high) >= 0.3
    changed = brighter = 0
    if compare is not None:
        if canvas_image.size != compare.size:
            raise ValueError(f'Matched canvas dimensions changed with score: {item["id"]}')
        before_pixels = getattr(compare, "get_flattened_data", compare.getdata)()
        after_pixels = getattr(canvas_image, "get_flattened_data", canvas_image.getdata)()
        for before, after in zip(before_pixels, after_pixels):
            changed += max(abs(a - b) for a, b in zip(after, before)) >= 32
            brighter += luminance(after) - luminance(before) >= 0.1
    total_pixels = viewport["width"] * viewport["height"]
    boundary = raw["paddle"]["boundary"]
    paddle_viewport_margins = [viewport_margin(p["bounds"], rect, viewport) for p in boundary]
    visible_paths = raw["trajectorySummary"]
    balls = [ball for ball in raw["balls"] if ball["visible"]]
    record = {
        "id": item["id"], "engine": item["engine"], "state": item["state"],
        "viewport": {"width": viewport["width"], "height": viewport["height"]},
        "canvasRect": rect, "drawingSize": [raw["canvas"]["drawingWidth"], raw["canvas"]["drawingHeight"]],
        "canvasViewportAreaRatio": raw["canvas"]["viewportOccupancy"],
        "visibleCanvasViewportAreaRatio": raw["canvas"]["visibleArea"] / total_pixels,
        "tableFrontWidthCss": raw["table"]["frontWidth"], "tableDepthCss": raw["table"]["screenDepth"],
        "tableCanvasMarginCss": raw["table"]["bounds"]["minimumCanvasMargin"],
        "tableViewportMarginCss": viewport_margin(raw["table"]["bounds"], rect, viewport),
        "paddleFaceCss": next(mesh["bounds"] for mesh in raw["paddle"]["initial"]["meshes"] if mesh["name"] == "frontRubber"),
        "paddleInitialViewportMarginCss": viewport_margin(raw["paddle"]["initial"]["bounds"], rect, viewport),
        "paddleBoundaryCanvasMarginCss": raw["paddle"]["minimumBoundaryMargin"],
        "paddleBoundaryViewportMarginCss": min(paddle_viewport_margins),
        "paddleBoundaryPlacementsOutsideViewport": sum(margin < 0 for margin in paddle_viewport_margins),
        "visibleBallCount": len(balls), "firstBallCss": balls[0]["displayed"] if balls else None,
        "trajectorySummary": visible_paths,
        "pixelArea": {
            "visibleCanvasPixels": visible_pixels,
            "highLuminancePixels": high_luminance,
            "highLuminanceViewportFraction": high_luminance / total_pixels,
            "brightSaturatedPixels": bright_saturated,
            "brightSaturatedViewportFraction": bright_saturated / total_pixels,
            "score0To555CanvasChangedPixels": changed if compare else None,
            "score0To555CanvasBrighterPixels": brighter if compare else None,
            "fullCanvasScreenshotPixels": canvas_image.width * canvas_image.height,
        },
        "pageErrors": raw["errors"],
    }
    records.append(record)

analysis = {
    "sourceHead": manifest["sourceHead"], "records": records,
    "pixelDefinitions": {
        "highLuminance": "Linear sRGB relative luminance >= 0.5; only pixels inside the visible CSS canvas.",
        "brightSaturated": "max(R,G,B) >= 192 and HSV saturation >= 0.3; only pixels inside the visible CSS canvas.",
        "canvasChanged": "Within the complete canvas screenshots at matched viewport/time, max absolute channel difference score0->555 >= 32.",
        "canvasBrighter": "Within the complete canvas screenshots at matched viewport/time, linear sRGB luminance(score555)-luminance(score0) >= 0.1.",
        "limitation": "Static coverage proxies; they do not identify every glowing shader pixel or establish flashing safety.",
    },
}
(directory / "analysis.json").write_text(json.dumps(analysis, indent=2) + "\n")
print(json.dumps({"records": len(records), "analysis": str(directory / "analysis.json")}))
