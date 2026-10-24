# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audio-layered.spec.ts >> 多層音と最終出力を44.1/48kHzで合成、単発と上限+減衰の波形を保存
- Location: tests/browser/audio-layered.spec.ts:5:1

# Error details

```
Error: page.evaluate: Error: Offline lifecycle adaptation failed
    at eval (eval at evaluate (:370:30), <anonymous>:36:44)
    at async <anonymous>:396:30
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
      - generic [ref=e16]:
        - generic [ref=e17]: ランキングの名前 任意
        - textbox "ランキングの名前 任意" [ref=e18]:
          - /placeholder: 名前なしでも遊べます
        - paragraph [ref=e19]: 20文字以内。入力すると名前と記録が公開され、カメレオンの実験場のランキングに参加します。同じ名前の記録は合算されます。名前なしのプレイも回数だけ記録します。
      - button "はじめる" [active] [ref=e20] [cursor=pointer]:
        - text: はじめる
        - generic [aria-hidden] [ref=e21]: ↗
      - paragraph [ref=e22]: 2本指で短くタップ、またはEscキーで一時停止
    - generic "遊び方" [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e26]: "01"
        - paragraph [ref=e27]:
          - strong [ref=e28]: タップで置く
          - generic [ref=e29]: 指やポインターの位置へ直接移動。
      - generic [ref=e30]:
        - generic [ref=e31]: "02"
        - paragraph [ref=e32]:
          - strong [ref=e33]: ドラッグで動かす
          - generic [ref=e34]: 押している間は、その位置について動きます。
      - generic [ref=e35]:
        - generic [ref=e36]: "03"
        - paragraph [ref=e37]:
          - strong [ref=e38]: 離すと止まる
          - generic [ref=e39]: 最後の位置を保ち、自分の返球で +1。
    - generic [ref=e40]:
      - paragraph [ref=e41]:
        - text: 自己ベスト
        - status "自己ベスト" [ref=e42]: "0"
        - text: ラリー
      - link "Xでシェア" [ref=e43] [cursor=pointer]:
        - /url: https://twitter.com/intent/tweet?text=%E3%82%BF%E3%83%83%E3%83%97%EF%BC%86%E3%83%89%E3%83%A9%E3%83%83%E3%82%B0%E3%81%A7%E9%81%8A%E3%81%B9%E3%82%8B%E5%8D%93%E7%90%83%E3%82%B2%E3%83%BC%E3%83%A0%E3%80%8C%E3%82%BF%E3%83%83%E3%82%B1%E3%82%A6%E3%80%8D%EF%BC%81%0A%E4%BD%95%E3%83%A9%E3%83%AA%E3%83%BC%E3%81%A4%E3%81%AA%E3%81%92%E3%82%89%E3%82%8C%E3%82%8B%EF%BC%9F+%23%E3%82%BF%E3%83%83%E3%82%B1%E3%82%A6&url=https%3A%2F%2Fchameleonjp-lab.github.io%2Ftakkeu%2F
      - link "カメレオンの実験場" [ref=e44] [cursor=pointer]:
        - /url: https://chameleonjp-lab.github.io/chameleonjp_lab/
      - button "設定" [ref=e45] [cursor=pointer]
    - status [ref=e46]: ホーム
```