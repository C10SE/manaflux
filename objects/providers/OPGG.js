const rp = require('request-promise-native'), cheerio = require('cheerio');
const { ItemSet, Block } = require('../ItemSet');
const Provider = require('./Provider');

class OPGGProvider extends Provider {
  constructor() {
    super('opgg', 'OP.GG');
    this.base = 'https://www.op.gg';
  }

  getOPGGPosition(pos) {
    switch(pos.toLowerCase()) {
      case 'middle':
        return 'mid';
      case 'adc':
        return 'bot';
      default:
        return pos.toLowerCase();
    }
  }

  convertOPGGPosition(pos) {
    switch(pos.toLowerCase()) {
      case 'mid':
        return 'middle';
      case 'bot':
        return 'adc';
      default:
        return pos.toLowerCase();
    }
  }

  async getData(champion, preferredPosition, gameMode) {
    const res = await rp(`${this.base}/champion/${champion.key}/statistics${preferredPosition ? '/' + this.convertOPGGPosition(preferredPosition) : ''}`);
    const data = this._scrape(res, champion, gameMode, this.getOPGGPosition(preferredPosition));

    let positions = {};
    positions[data.position] = data;

    for (const position of data.availablePositions) {
      console.log(`[OP.GG] Gathering data for ${position.name} position`);

      const d = await rp(position.link);
      positions[position.name] = this._scrape(d, champion, position.name, gameMode);
    }

    console.dir(positions);
    return positions;
  }

  async getSummonerSpells(champion, position, gameMode) {
    const { summonerspells } = await this.getData(champion, position, gameMode);
    return summonerspells;
  }

  async getItemSets(champion, position, gameMode) {
    const { itemsets } = await this.getData(champion, position, gameMode);
    return itemsets;
  }

  async getRunes(champion, position, gameMode) {
    const { runes } = await this.getData(champion, position, gameMode);
    return runes;
  }

  _scrape(html, champion, position, gameMode) {
    let $ = cheerio.load(html);

    const version = $('.champion-stats-header-version').text().trim().slice(-4);
    const convertOPGGPosition = this.convertOPGGPosition;

    if (version != Mana.gameVersion) UI.error('OP.GG: ' + i18n.__('providers-error-outdated'));

    position = this.convertOPGGPosition($('li.champion-stats-header__position.champion-stats-header__position--active').data('position')).toUpperCase();
    let availablePositions = [];

    $('[data-position] > a').each(function(index) {
      availablePositions.push({ name: convertOPGGPosition($(this).parent().data('position')).toUpperCase(), link: 'https://op.gg' + $(this).attr('href') });
    });

    const summonerspells = this.scrapeSummonerSpells($);

    const skillorder = this.scrapeSkillOrder($);
    const itemsets = this.scrapeItemSets($, champion, position.charAt(0) + position.slice(1).toLowerCase(), skillorder);

    const runes = this.scrapeRunes($, champion, position);

    return { runes, summonerspells, itemsets, availablePositions, position };
  }

  /**
   * Scrapes item sets from a Champion.gg page
   * @param {cheerio} $ - The cheerio object
   * @param {object} champion - A champion object, from Mana.champions
   * @param {string} position - Limited to: TOP, JUNGLE, MIDDLE, ADC, SUPPORT
   */
  scrapeRunes($, champion, position) {
    let pages = [{ selectedPerkIds: [] }, { selectedPerkIds: [] }];

    $('.perk-page').find('img.perk-page__image.tip').slice(0, 4).each(function(index) {
      const page = Math.trunc(index / 2);

      pages[page].name = `OPG${page + 1} ${champion.name} ${position}`;
      pages[page][index % 2 === 0 ? 'primaryStyleId' : 'subStyleId'] = parseInt($(this).attr('src').slice(-8, -4));
    });

    $('.perk-page__item--active').find('img').slice(0, 12).each(function(index) {
      pages[Math.trunc(index / 6)].selectedPerkIds.push(parseInt($(this).attr('src').slice(-8, -4)));
    });

    return pages;
  }

  /**
   * Scrapes summoner spells from a Champion.gg page
   * @param {cheerio} $ - The cheerio object
   * @param {string} gameMode - A gamemode, from League Client, such as CLASSIC, ARAM, etc.
   */
  scrapeSummonerSpells($, gameMode) {
    let summonerspells = [];

    $("img[src^='//opgg-static.akamaized.net/images/lol/spell/Summoner']").slice(0, 2).each(function(index) {
      const summoner = Mana.summonerspells[$(this).attr('src').slice(45, -19)];

      if (!summoner) return;
      if (summoner.gameModes.includes(gameMode)) summonerspells.push(summoner.id);

      if (index >= 1 && summonerspells.length === 2) return false;
    });

    return summonerspells;
  }

  /**
   * Scrapes skill order from a Champion.gg page
   * @param {cheerio} $ - The cheerio object
   * @param {function} convertSkillOrderToLanguage - Default function
   */
  scrapeSkillOrder($, convertSkillOrderToLanguage = this.convertSkillOrderToLanguage) {
    let skillorder = '';
    const skills = $('.champion-stats__list').eq(2).find('li:not(.champion-stats__list__arrow) > img').each(function(index) {
      skillorder += (skillorder !== '' ? ' => ' : '') + convertSkillOrderToLanguage($(this).siblings().text());
    });

    return skillorder;
  }

  /**
   * Scrapes item sets from a Champion.gg page
   * @param {cheerio} $ - The cheerio object
   * @param {object} champion - A champion object, from Mana.champions
   * @param {string} position - Limited to: TOP, JUNGLE, MIDDLE, ADC, SUPPORT
   * @param {object} skillorder
   */
  scrapeItemSets($, champion, position, skillorder) {
    const itemrows = $('.champion-overview__table').eq(1).find('.champion-overview__row');

    let itemset = new ItemSet(champion.key, position).setTitle(`OPG ${champion.name} - ${position}`);
    let boots = new Block().setName(i18n.__('itemsets-block-boots'));

    // Starter
    itemrows.slice(0, 2).each(function(index) {
      let starter = new Block().setName(i18n.__('itemsets-block-starter-numbered', index + 1, skillorder));
      let pots = 0;

      let items = {};
      $(this).find('img').each(function(index) {
        const id = $(this).attr('src').slice(44, 48);
        items[id] = items[id] + 1 || 1;
      });

      for (var [id, count] of Object.entries(items))
        starter.addItem(id, count);

      itemset.addBlock(starter);
    });

    itemset.addBlock(new Block().setName(`Trinkets`).addItem(2055).addItem(3340).addItem(3341).addItem(3348).addItem(3363));

    // Recommanded Items
    let recommanded = [];
    itemrows.slice(2, -3).find('li:not(.champion-stats__list__arrow) > img').each(function(index) {
      const id = $(this).attr('src').slice(44, 48);
      if (!recommanded.includes(id)) recommanded.push({ id, count: 1 });
    });

    itemset.addBlock(new Block().setName(i18n.__('itemsets-block-recommanded')).setItems(recommanded));

    // Boots
    itemrows.slice(-3).find('img').each(function(index) {
      boots.addItem($(this).attr('src').slice(44, 48));
    });

    itemset.addBlock(boots);
    itemset.addBlock(new Block().setName(i18n.__('itemsets-block-consumables')).addItem(2003).addItem(2138).addItem(2139).addItem(2140));

    return [itemset];
  }
}

module.exports = OPGGProvider;
