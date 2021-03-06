class Provider {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  async getData(champion, preferredPosition, gameMode) {
    throw Error(`[ProviderHandler] ${this.name} ${i18n.__('providers-skipped')}: #getData`);
  }

  async getSummonerSpells(champion, position, gameMode) {
    throw Error(`[ProviderHandler] ${this.name} ${i18n.__('providers-skipped')}: #getSummonerSpells`);
  }

  async getItemSets(champion, position, gameMode) {
    throw Error(`[ProviderHandler] ${this.name} ${i18n.__('providers-skipped')}: #getItemSets`);
  }

  async getRunes(champion, position, gameMode) {
    throw Error(`[ProviderHandler] ${this.name} ${i18n.__('providers-skipped')}: #getRunes`);
  }

  convertSkillOrderToLanguage(letter) {
    if (i18n._locale === 'fr') {
      switch(letter) {
        case 'Q':
        return 'A';
        case 'W':
        return 'Z';
        default:
        return letter;
      }
    }

    return letter;
  }
}

module.exports = Provider;
