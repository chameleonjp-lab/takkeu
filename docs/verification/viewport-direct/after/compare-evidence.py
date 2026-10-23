"""Compare unchanged capture/analysis outputs; no browser or product mutation."""
import gzip
import json
import pathlib

after_dir = pathlib.Path(__file__).resolve().parent
before_dir = after_dir.parent / "baseline"
before_manifest = json.loads((before_dir / "manifest.json").read_text())
after_manifest = json.loads((after_dir / "manifest.json").read_text())
before = {r["id"]: r for r in json.loads((before_dir / "analysis.json").read_text())["records"]}
after = json.loads((after_dir / "analysis.json").read_text())["records"]


def raw(directory, record_id):
    with gzip.open(directory / (record_id + ".json.gz"), "rt") as stream:
        return json.load(stream)


records = []
for a in after:
    b = before[a["id"]]
    ar, br = raw(after_dir, a["id"]), raw(before_dir, a["id"])
    scales = {
        "tableFrontWidth": a["tableFrontWidthCss"] / b["tableFrontWidthCss"],
        "tableDepth": a["tableDepthCss"] / b["tableDepthCss"],
        "paddleFaceWidth": a["paddleFaceCss"]["width"] / b["paddleFaceCss"]["width"],
        "paddleFaceHeight": a["paddleFaceCss"]["height"] / b["paddleFaceCss"]["height"],
        "firstBallWidth": a["firstBallCss"]["width"] / b["firstBallCss"]["width"],
        "firstBallHeight": a["firstBallCss"]["height"] / b["firstBallCss"]["height"],
    }
    frozen = {
        "config": ar["config"] == br["config"],
        "viewpoint": ar["viewpoint"] == br["viewpoint"],
        "referenceAspect": ar["referenceAspect"] == br["referenceAspect"],
        "cameraPoseAndClip": all(ar["camera"][k] == br["camera"][k] for k in ["position", "quaternion", "near", "far", "matrixWorld", "matrixWorldInverse"]),
        "initialPaddle": ar["snapshot"]["paddle"] == br["snapshot"]["paddle"] == {"x": 0, "y": 0.5},
        "paddleMeshVertices": ar["paddle"]["meshGeometry"] == br["paddle"]["meshGeometry"],
        "clampedBoundaryPoints": [p["point"] for p in ar["paddle"]["boundary"]] == [p["point"] for p in br["paddle"]["boundary"]],
        "ballSnapshots": ar["snapshot"]["balls"] == br["snapshot"]["balls"],
        "trajectoryPlans": all(ap["from"] == bp["from"] and ap["plan"] == bp["plan"] for ap, bp in zip(ar["trajectories"], br["trajectories"])),
        "trajectoryWorldSamples": all([s["position"] for s in ap["visibleSamples"]] == [s["position"] for s in bp["visibleSamples"]] for ap, bp in zip(ar["trajectories"], br["trajectories"])),
        "browserVersion": ar["browserVersion"] == br["browserVersion"],
    }
    rect = a["canvasRect"]
    coverage_error = max(abs(rect["x"]), abs(rect["y"]), abs(rect["width"] - a["viewport"]["width"]), abs(rect["height"] - a["viewport"]["height"]))
    records.append({
        "id": a["id"], "engine": a["engine"], "viewport": a["viewport"], "state": a["state"],
        "browserVersion": ar["browserVersion"], "before": b, "after": a, "scaleFactors": scales,
        "maxScaleFactorSpread": max(scales.values()) - min(scales.values()),
        "frozenParametersEqual": frozen, "viewportCoverageMaxCssError": coverage_error,
        "allTableCornersInsideViewport": a["tableViewportMarginCss"] >= 0,
        "allPaddleBoundaryVerticesInsideViewport": a["paddleBoundaryViewportMarginCss"] >= 0 and a["paddleBoundaryPlacementsOutsideViewport"] == 0,
        "allSampledVisibleTrajectorySpheresInsideCanvas": a["trajectorySummary"]["sphereClippedSamples"] == 0,
        "brightSaturatedViewportAreaRatio": a["pixelArea"]["brightSaturatedViewportFraction"] / b["pixelArea"]["brightSaturatedViewportFraction"],
        "highLuminanceViewportAreaRatio": a["pixelArea"]["highLuminanceViewportFraction"] / b["pixelArea"]["highLuminanceViewportFraction"],
    })

webkit_differences = []
for c in [r for r in records if r["engine"] == "chromium"]:
    w = next(r for r in records if r["engine"] == "webkit" and r["viewport"] == c["viewport"] and r["state"] == c["state"])
    webkit_differences.append({
        "viewport": c["viewport"], "state": c["state"],
        "tableWidthDifferenceCss": w["after"]["tableFrontWidthCss"] - c["after"]["tableFrontWidthCss"],
        "tableDepthDifferenceCss": w["after"]["tableDepthCss"] - c["after"]["tableDepthCss"],
        "paddleFaceWidthDifferenceCss": w["after"]["paddleFaceCss"]["width"] - c["after"]["paddleFaceCss"]["width"],
        "brightSaturatedViewportFractionDifference": w["after"]["pixelArea"]["brightSaturatedViewportFraction"] - c["after"]["pixelArea"]["brightSaturatedViewportFraction"],
        "highLuminanceViewportFractionDifference": w["after"]["pixelArea"]["highLuminanceViewportFraction"] - c["after"]["pixelArea"]["highLuminanceViewportFraction"],
    })

result = {
    "beforeSha": before_manifest["sourceHead"], "afterSha": after_manifest["sourceHead"],
    "records": records, "webkitMinusChromium": webkit_differences,
    "summary": {
        "matchedRecords": len(records), "captureFailures": after_manifest["failures"],
        "allFrozenParametersEqual": all(all(r["frozenParametersEqual"].values()) for r in records),
        "maximumViewportCoverageErrorCss": max(r["viewportCoverageMaxCssError"] for r in records),
        "minimumLinearScale": min(min(r["scaleFactors"].values()) for r in records),
        "maximumLinearScale": max(max(r["scaleFactors"].values()) for r in records),
        "maximumScaleFactorSpread": max(r["maxScaleFactorSpread"] for r in records),
        "allTableCornersInsideViewport": all(r["allTableCornersInsideViewport"] for r in records),
        "allPaddleBoundaryVerticesInsideViewport": all(r["allPaddleBoundaryVerticesInsideViewport"] for r in records),
        "allSampledVisibleTrajectorySpheresInsideCanvas": all(r["allSampledVisibleTrajectorySpheresInsideCanvas"] for r in records),
        "pageErrors": [error for r in records for error in r["after"]["pageErrors"]],
    },
}
(after_dir / "comparison-data.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
