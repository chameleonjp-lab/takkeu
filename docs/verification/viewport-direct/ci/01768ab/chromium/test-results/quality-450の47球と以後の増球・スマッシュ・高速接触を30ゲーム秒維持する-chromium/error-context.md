# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: quality.spec.ts >> 450の47球と以後の増球・スマッシュ・高速接触を30ゲーム秒維持する
- Location: tests/browser/quality.spec.ts:95:1

# Error details

```
Test timeout of 180000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=e1]:
  - generic [ref=e2]:
    - generic "卓球ゲームの描画領域" [active] [ref=e5]
    - generic:
      - generic:
        - generic: RALLY
        - status "ラリー数": "539"
      - generic:
        - generic: 残球数
        - status "残球数": "83"
      - status: スマッシュがくる！
    - generic:
      - generic:
        - status: 残球数83。
```