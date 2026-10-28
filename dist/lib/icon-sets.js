export const ICON_SETS = {
    accounting: {
        description: '会計・経理・業務（領収書、請求書、銀行、承認、印鑑、財布、硬貨、電卓、契約書など）',
        icons: {
            receipt: 'mdi:receipt-text', invoice: 'mdi:file-document-outline', 'invoice-send': 'mdi:file-send-outline', quote: 'mdi:file-document-edit-outline',
            contract: 'mdi:file-sign', bank: 'mdi:bank', 'bank-transfer': 'mdi:bank-transfer', approval: 'mdi:check-decagram', approve: 'mdi:check-circle-outline',
            reject: 'mdi:close-circle-outline', stamp: 'mdi:stamper', seal: 'mdi:seal', signature: 'mdi:draw', wallet: 'mdi:wallet-outline', coins: 'mdi:coins',
            cash: 'mdi:cash', 'cash-multiple': 'mdi:cash-multiple', calculator: 'mdi:calculator', 'credit-card': 'mdi:credit-card-outline', 'piggy-bank': 'mdi:piggy-bank-outline',
            safe: 'mdi:safe', ledger: 'mdi:book-open-page-variant-outline', journal: 'mdi:notebook-outline', 'chart-line': 'mdi:chart-line', 'chart-bar': 'mdi:chart-bar',
            'chart-pie': 'mdi:chart-pie', percent: 'mdi:percent-outline', tax: 'mdi:file-percent-outline', yen: 'mdi:currency-jpy', dollar: 'mdi:currency-usd',
            euro: 'mdi:currency-eur', 'cash-register': 'mdi:cash-register', store: 'mdi:store-outline', cart: 'mdi:cart-outline', 'truck-delivery': 'mdi:truck-delivery-outline',
            package: 'mdi:package-variant-closed', 'scale-balance': 'mdi:scale-balance', audit: 'mdi:clipboard-check-outline', report: 'mdi:file-chart-outline',
            clock: 'mdi:clock-outline', calendar: 'mdi:calendar-month-outline', 'calendar-check': 'mdi:calendar-check-outline', person: 'mdi:account-outline',
            team: 'mdi:account-group-outline', 'person-tie': 'mdi:account-tie-outline', building: 'mdi:domain', mail: 'mdi:email-outline', attachment: 'mdi:paperclip',
            archive: 'mdi:archive-outline', folder: 'mdi:folder-outline', lock: 'mdi:lock-outline', shield: 'mdi:shield-check-outline', alert: 'mdi:alert-outline',
            'cash-refund': 'mdi:cash-refund', 'hand-coin': 'mdi:hand-coin-outline', 'finance': 'mdi:finance', 'database': 'mdi:database-outline', upload: 'mdi:upload-outline',
            download: 'mdi:download-outline', printer: 'mdi:printer-outline', scanner: 'mdi:scanner',
        },
    },
    office: {
        description: '一般的なオフィス・コミュニケーション（人、会議、文書、メール、予定、電話など）',
        icons: {
            person: 'mdi:account-outline', team: 'mdi:account-group-outline', 'person-tie': 'mdi:account-tie-outline', building: 'mdi:domain', home: 'mdi:home-outline',
            mail: 'mdi:email-outline', phone: 'mdi:phone-outline', chat: 'mdi:chat-outline', bell: 'mdi:bell-outline', calendar: 'mdi:calendar-month-outline',
            clock: 'mdi:clock-outline', document: 'mdi:file-document-outline', folder: 'mdi:folder-outline', clipboard: 'mdi:clipboard-text-outline', note: 'mdi:note-text-outline',
            table: 'mdi:table', presentation: 'mdi:presentation', 'chart-bar': 'mdi:chart-bar', 'chart-line': 'mdi:chart-line', 'chart-pie': 'mdi:chart-pie',
            search: 'mdi:magnify', edit: 'mdi:pencil-outline', delete: 'mdi:delete-outline', check: 'mdi:check-circle-outline', close: 'mdi:close-circle-outline',
            alert: 'mdi:alert-outline', info: 'mdi:information-outline', help: 'mdi:help-circle-outline', lock: 'mdi:lock-outline', key: 'mdi:key-variant', star: 'mdi:star-outline',
            flag: 'mdi:flag-outline', bookmark: 'mdi:bookmark-outline', link: 'mdi:link-variant', attachment: 'mdi:paperclip', printer: 'mdi:printer-outline',
            laptop: 'mdi:laptop', monitor: 'mdi:monitor', tablet: 'mdi:tablet', smartphone: 'mdi:cellphone', camera: 'mdi:camera-outline', video: 'mdi:video-outline',
            microphone: 'mdi:microphone-outline', 'calendar-check': 'mdi:calendar-check-outline', lightbulb: 'mdi:lightbulb-outline', target: 'mdi:target', handshake: 'mdi:handshake-outline',
            globe: 'mdi:web', 'map-marker': 'mdi:map-marker-outline', cart: 'mdi:cart-outline', gift: 'mdi:gift-outline', settings: 'mdi:cog-outline',
        },
    },
    infra: {
        description: 'IT インフラ（サーバー、DB、ネットワーク、クラウド、セキュリティ、コンテナ、監視など）',
        icons: {
            server: 'mdi:server', 'server-network': 'mdi:server-network', database: 'mdi:database-outline', storage: 'mdi:harddisk', cloud: 'mdi:cloud-outline',
            'cloud-upload': 'mdi:cloud-upload-outline', 'cloud-download': 'mdi:cloud-download-outline', network: 'mdi:lan', router: 'mdi:router-network', switch: 'mdi:switch',
            wifi: 'mdi:wifi', firewall: 'mdi:wall-fire', 'load-balancer': 'mdi:scale-balance', vpn: 'mdi:vpn', globe: 'mdi:web', dns: 'mdi:dns-outline',
            container: 'mdi:docker', kubernetes: 'mdi:kubernetes', 'git': 'mdi:git', github: 'mdi:github', api: 'mdi:api', code: 'mdi:code-braces', terminal: 'mdi:console',
            bug: 'mdi:bug-outline', queue: 'mdi:tray-full', cache: 'mdi:lightning-bolt-outline', 'cpu': 'mdi:chip', memory: 'mdi:memory', lock: 'mdi:lock-outline',
            key: 'mdi:key-variant', shield: 'mdi:shield-check-outline', certificate: 'mdi:certificate-outline', user: 'mdi:account-outline', users: 'mdi:account-group-outline',
            laptop: 'mdi:laptop', monitor: 'mdi:monitor', smartphone: 'mdi:cellphone', 'monitoring': 'mdi:monitor-dashboard', log: 'mdi:text-box-outline', alert: 'mdi:alert-outline',
            backup: 'mdi:backup-restore', 'sync': 'mdi:sync', 'schedule': 'mdi:clock-outline', 'file': 'mdi:file-outline', folder: 'mdi:folder-outline', 'email': 'mdi:email-outline',
            'chart': 'mdi:chart-line', 'settings': 'mdi:cog-outline', 'deploy': 'mdi:rocket-launch-outline', 'package': 'mdi:package-variant-closed',
        },
    },
};
/** The `set:icon=name` arguments `icons add` takes. */
export function setArgs(name) {
    const s = ICON_SETS[name];
    if (!s)
        throw new Error(`no icon set "${name}" (${Object.keys(ICON_SETS).join(', ')}) — svg-diagram icons sets`);
    return Object.entries(s.icons).map(([n, id]) => `${id}=${n}`);
}
