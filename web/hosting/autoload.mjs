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
    const id = 'majesty';
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
