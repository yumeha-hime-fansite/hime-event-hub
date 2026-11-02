/* スプレッドシートを初回に一度だけ接続してください。
 * URL https://docs.google.com/spreadsheets/d/【ID】/edit#gid=【gid】
 * 公開できる情報専用のシートを「リンクを知っている全員／閲覧者」に設定。
 * GitHub の画像は assets/hime-left.png / assets/hime-right.png に保存。
 */
window.HIME_CONFIG = {
  sheetId: '',    // IDを入れるとデモ情報の代わりに公開シートを読み込みます
  sheetGid: '0',   // シートタブの gid
  siteName: '夢羽ヒメ',
  siteUrl: ''    // 任意。X投稿の案内に載せたい実際のサイトURLを入力
};
