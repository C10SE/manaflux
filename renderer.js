// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const request = require('request'), rp = require('request-promise-native');
const Store = require('electron-store');

const { dialog } = require('electron').remote;

const ItemSetHandler = require('./objects/handlers/ItemSetHandler');

Mana.version = require('./package.json').version;
Mana.status = str => {
  $('.status').text(str + '...');
  console.log(str + '...');
};
Mana.store = new Store();

if (Mana.store.get('enableTrayIcon')) UI.tray();

Mana.status(i18n.__('loading-storage'));

$(document).ready(function() {
  if (!Mana.store.has('data'))
    Mana.store.set('data', {});

  if (!Mana.store.has('summonerspells'))
    Mana.store.set('summonerspells', {});

  if (!Mana.store.has('loadRunesAutomatically'))
    Mana.store.set('loadRunesAutomatically', true);

  if (!Mana.store.has('enableSummonerSpells'))
    Mana.store.set('enableSummonerSpellButton', false);

  if (!Mana.store.has('enableItemSets'))
    Mana.store.set('enableItemSets', false);

  if (!Mana.store.has('auto-start'))
    Mana.store.set('auto-start', false);

  if (!Mana.store.has('enableTrayIcon'))
    Mana.store.set('enableTrayIcon', false);

  if (!Mana.store.has('theme'))
    Mana.store.set('theme', 'themes/default-bg.jpg');

  if (!Mana.store.has('riot-consent')) {
    dialog.showMessageBox({ title: i18n.__('info'), message: i18n.__('consent') });
    Mana.store.set('riot-consent', true);
  }

  Mana.store.set('lastVersion', Mana.version);

  if (!Mana.store.has('leaguePath')) {
    Mana.status(i18n.__('league-client-start-required'));
    UI.error(i18n.__('league-client-start-required-explanation'));

    ipcRenderer.once('lcu-league-path', (event, path) => {
      Mana.status('League: ' + i18n.__('path-found'));

      console.log(`[LeaguePlug] ${i18n.__('path-found')}`);
      console.log(`[LeaguePlug] ${path}`);

      Mana.store.set('leaguePath', path);
      ipcRenderer.send('lcu-connection', path);
    }).send('lcu-league-path');
  }
  else ipcRenderer.send('lcu-connection', Mana.store.get('leaguePath'));
  Mana.emit('settings', Mana.store);
});

ipcRenderer.on('lcu-connected', async (event, d) => {
  Mana.base = d.baseUri;
  Mana.riot = d;
});

ipcRenderer.once('lcu-connected', async (event, d) => {
  Mana.user = new (require('./User'))(Mana.base);
  Mana.client = require('./objects/Client');
  Mana.championselect = new (require('./objects/ChampionSelect'))();

  Mana.status(i18n.__('loading-data'));

  Mana.assetsProxy = new (require('./objects/RiotAssetsProxy'))();
  Mana.assetsProxy.load();

  const data = await Promise.all([Mana.client.getChampionSummary(), Mana.client.getSummonerSpells()]);

  Mana.champions = data[0];
  Mana.summonerspells = data[1];

  const ver = await Mana.client.getVersion();
  Mana.store.set('gameVersion', ver);
  $('.version').text($('.version').text() + ' - V' + (Mana.gameVersion = ver));

  if (Mana.store.get('gameVersion') !== ver) {
    Mana.store.set('data', {});
    ItemSetHandler.getItemSets().then(x => ItemSetHandler.deleteItemSets(x)).catch(UI.error);
  }
});

ipcRenderer.on('lcu-logged-in', async (event, data) => {
  Mana.status(i18n.__('league-client-connection'));

  await Mana.user.load(data);
  Mana.championselect.load();

  Mana.status(i18n.__('champion-select-waiting'));

  global._devChampionSelect = () => new (require('./CustomGame'))().create().then(game => game.start());
});

ipcRenderer.on('lcu-disconnected', async () => {
  global._devChampionSelect = () => console.log(`[${i18n.__('error')}] ${i18n.__('developer-game-start-error')}\n${i18n.__('league-client-disconnected')}`);

  if (Mana.championselect) Mana.championselect.end().destroy();
  Mana.status(i18n.__('disconnected'));
});

global.autoStart = function(checked) {
  ipcRenderer.send(`auto-start-${checked ? 'en' : 'dis'}able`);
}

global._devChampionSelect = () => console.log(`[${i18n.__('error')}] ${i18n.__('developer-game-start-error')}\n${i18n.__('league-client-disconnected')}`);
