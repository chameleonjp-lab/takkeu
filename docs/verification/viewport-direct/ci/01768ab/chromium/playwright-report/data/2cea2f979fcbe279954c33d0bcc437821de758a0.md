# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extended.spec.ts >> 555の91球から毎ラリー加速・全スマッシュ・増球を30ゲーム秒継続する
- Location: tests/browser/extended.spec.ts:54:1

# Error details

```
Test timeout of 240000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [aria-hidden] [ref=e6]: t.
      - generic [ref=e7]: TAKKEU
      - generic [ref=e8]: 卓球の、その先へ。
    - generic [ref=e10]:
      - paragraph [ref=e11]: ONE BALL. ENDLESS RALLY.
      - heading "タッケウ" [level=1] [ref=e13]: タッケウ.
      - paragraph [ref=e14]: ワンバウンドをとらえて、ラリーをつなぐ。
      - paragraph [ref=e15]: タップした位置にラケットを置き、ドラッグで球に合わせる。自分の台で一度弾んだ球に触れれば、打ち返せます。
      - button "はじめる" [active] [ref=e16] [cursor=pointer]:
        - text: はじめる
        - generic [aria-hidden] [ref=e17]: ↗
      - paragraph [ref=e18]: 2本指で短くタップ、またはEscキーで一時停止
    - generic "遊び方" [ref=e20]:
      - generic [ref=e21]:
        - generic [ref=e22]: "01"
        - paragraph [ref=e23]:
          - strong [ref=e24]: タップで置く
          - generic [ref=e25]: 指やポインターの位置へ直接移動。
      - generic [ref=e26]:
        - generic [ref=e27]: "02"
        - paragraph [ref=e28]:
          - strong [ref=e29]: ドラッグで動かす
          - generic [ref=e30]: 押している間は、その位置について動きます。
      - generic [ref=e31]:
        - generic [ref=e32]: "03"
        - paragraph [ref=e33]:
          - strong [ref=e34]: 離すと止まる
          - generic [ref=e35]: 最後の位置を保ち、自分の返球で +1。
    - generic [ref=e36]:
      - paragraph [ref=e37]:
        - text: 自己ベスト
        - status "自己ベスト" [ref=e38]: "670"
        - text: ラリー
      - button "設定" [ref=e39] [cursor=pointer]
    - status [ref=e40]: ホーム
```