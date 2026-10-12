export class AutomaticLaunch {
  #pending = null;
  #launched = false;
  constructor({href, status, navigate}) {
    this.url = new URL(href);
    this.status = status;
    this.navigate = navigate;
  }
  check() {
    if (this.url.searchParams.get('setup') === '1' || this.#launched) return Promise.resolve(false);
    if (this.#pending) return this.#pending;
    const edition = this.url.searchParams.get('edition');
    if (edition && edition !== 'wayfinder-v1') return Promise.resolve(false);
    const id = edition ? 'majesty-wayfinder' : 'majesty';
    this.#pending = (async () => {
      const result = await this.status(id);
      if (result?.status?.state !== 'ready') return false;
      const target = new URL('majesty/', this.url);
      target.search = this.url.search;
      target.hash = this.url.hash;
      this.#launched = true;
      this.navigate(target.href);
      return true;
    })().finally(() => { this.#pending = null; });
    return this.#pending;
  }
}
