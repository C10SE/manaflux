class ProviderHandler {
  constructor() {
    this.providers = {
      championgg: new (require('../providers/ChampionGG.js'))(),
      opgg: new (require('../providers/OPGG.js'))(),
      lolflavor: new (require('../providers/LoLFlavor.js'))()
    };
  }

  async getChampionData(champion, preferredPosition, gameMode) {
    /*
    * 1/3 Storage Checking
    */
    if (Mana.store.has(`data.${champion.key}`)) {
      let d = Mana.store.get(`data.${champion.key}`);

      for (let [position, data] of Object.entries(d)) {
        for (let i = 0; i < data.itemsets.length; i++)
          data.itemsets[i] = require('./ItemSetHandler').parse(champion.key, data.itemsets[i]._data, position);

        data.summonerspells = this.sortSummonerSpells(data.summonerspells || []);
      }

      return d;
    }

    /*
     * 2/3 Downloading
    */

    let positions = {};

    let providerOrder = Mana.store.get('providers-order');
    providerOrder.splice(providerOrder.indexOf('lolflavor'), 1);
    providerOrder.push('lolflavor');
    console.dir(providerOrder);

    for (let i = 0; i < providerOrder.length; i++) {
      const provider = this.providers[providerOrder[i]];
      console.log('Using provider: ' + provider.name);

      try {
        let method = 'getData';

        if (positions[preferredPosition]) {
          if (positions[preferredPosition].itemsets.length === 0 && Mana.store.get('enableItemSets'))
            method = 'getItemSets';
          else if (positions[preferredPosition].summonerspells.length === 0 && Mana.store.get('enableSummonerSpells'))
            method = 'getSummonerSpells';
          else if (positions[preferredPosition].runes.length === 0)
            method = 'getRunes';
        }

        const d = await provider[method](champion, preferredPosition, gameMode) || {};

        for (let [position, data] of Object.entries(d)) {
          data.summonerspells = this.sortSummonerSpells(data.summonerspells || []);
          positions[position] = Object.assign(positions[position] || { runes: {}, itemsets: {}, summonerspells: {} }, data);
        }

        break;
      }
      catch(err) {
        console.error(err);
      }
    }

    /*
    * 3/3 Saving
    */

    if (positions !== {}) Mana.store.set(`data.${champion.key}`, positions);

    return positions;
  }

  sortSummonerSpells(spells) {
    return spells.sort((a, b) => a === 4 || a === 6 ? (Mana.store.get('summoner-spells-priority') === "f" ? 1 : -1) : -1);
  }
}

module.exports = ProviderHandler;
