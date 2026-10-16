import { defineConfig } from 'vitepress'

// GitHub Pages project site: https://<user>.github.io/air-settlement-kb/
export default defineConfig({
  title: '机票结算知识库',
  description: '机票结算报表缺单排查与相关事实（人读 + Cursor Skill）',
  lang: 'zh-CN',
  base: '/air-settlement-kb/',
  srcDir: 'docs/settlement-kb/air',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '缺单排查', link: '/missing-order-playbook' },
      { text: '给 Cursor 同事', link: '/for-developers' }
    ],
    sidebar: [
      {
        text: '知识库',
        items: [
          { text: '首页与范围', link: '/' },
          { text: '生成链路', link: '/pipeline' },
          { text: '库表与字段', link: '/tables' },
          { text: '缺单排查 Playbook', link: '/missing-order-playbook' },
          { text: '已知坑', link: '/pitfalls' },
          { text: '给开发 / Cursor', link: '/for-developers' }
        ]
      }
    ],
    search: { provider: 'local' },
    outline: { label: '本页目录' },
    socialLinks: []
  }
})
