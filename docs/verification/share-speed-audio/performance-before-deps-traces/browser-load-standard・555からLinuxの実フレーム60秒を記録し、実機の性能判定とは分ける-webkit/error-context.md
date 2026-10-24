# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser-load.spec.ts >> standard・555からLinuxの実フレーム60秒を記録し、実機の性能判定とは分ける
- Location: tests/performance/browser-load.spec.ts:6:90

# Error details

```
Error: browserType.launch: 
╔══════════════════════════════════════════════════════╗
║ Host system is missing dependencies to run browsers. ║
║ Missing libraries:                                   ║
║     libhidapi-hidraw.so.0                            ║
║     libGLESv2.so.2                                   ║
╚══════════════════════════════════════════════════════╝
```