(() => {
  const data = Array.isArray(window.PKD_DATA) ? window.PKD_DATA : [];
  const search = document.querySelector('#search');
  const section = document.querySelector('#section');
  const clear = document.querySelector('#clear');
  const list = document.querySelector('#list');
  const status = document.querySelector('#status');
  const empty = document.querySelector('#empty');
  const more = document.querySelector('#more');
  const pageSize = 60;
  let limit = pageSize;
  let matches = data;

  const normalize = (value) => String(value)
    .toLocaleLowerCase('pl-PL')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const indexed = data.map((item) => ({
    ...item,
    searchable: normalize(`${item.code} ${item.code.replace(/\W/g, '')} ${item.description} ${item.section} ${item.division}`)
  }));

  const sectionNames = {
    A: 'Rolnictwo, leśnictwo i rybactwo',
    B: 'Górnictwo i wydobywanie',
    C: 'Przetwórstwo przemysłowe',
    D: 'Wytwarzanie i zaopatrywanie w energię elektryczną, gaz, parę wodną i powietrze do układów klimatyzacyjnych',
    E: 'Dostawa wody; gospodarowanie ściekami i odpadami oraz rekultywacja',
    F: 'Budownictwo',
    G: 'Handel hurtowy i detaliczny',
    H: 'Transport i gospodarka magazynowa',
    I: 'Zakwaterowanie i usługi gastronomiczne',
    J: 'Działalność wydawnicza i nadawcza oraz produkcja i dystrybucja treści',
    K: 'Telekomunikacja, programowanie, doradztwo, infrastruktura obliczeniowa i informacja',
    L: 'Działalność finansowa i ubezpieczeniowa',
    M: 'Obsługa rynku nieruchomości',
    N: 'Działalność profesjonalna, naukowa i techniczna',
    O: 'Usługi administrowania i działalność wspierająca',
    P: 'Administracja publiczna i obrona narodowa; obowiązkowe ubezpieczenia społeczne',
    Q: 'Edukacja',
    R: 'Opieka zdrowotna i pomoc społeczna',
    S: 'Kultura, sport i rekreacja',
    T: 'Pozostała działalność usługowa',
    U: 'Gospodarstwa domowe',
    V: 'Organizacje i zespoły eksterytorialne'
  };

  [...new Set(data.map((item) => item.section))].sort().forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `${value} — ${sectionNames[value] || 'Pozostałe'}`;
    section.append(option);
  });

  function appendHighlighted(parent, text, query) {
    if (!query) {
      parent.textContent = text;
      return;
    }
    const normalizedText = normalize(text);
    const normalizedQuery = normalize(query);
    const index = normalizedText.indexOf(normalizedQuery);
    if (index < 0) {
      parent.textContent = text;
      return;
    }
    parent.append(document.createTextNode(text.slice(0, index)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(index, index + query.length);
    parent.append(mark, document.createTextNode(text.slice(index + query.length)));
  }

  function resultCard(item, query) {
    const article = document.createElement('article');
    article.className = 'result-card';
    const code = document.createElement('div');
    code.className = 'code';
    appendHighlighted(code, item.code, query);

    const content = document.createElement('div');
    const description = document.createElement('p');
    description.className = 'description';
    appendHighlighted(description, item.description, query);
    const meta = document.createElement('div');
    meta.className = 'meta';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `Sekcja ${item.section}`;
    meta.append(badge, `Dział ${item.division}`, `Grupa ${item.group}`, `Klasa ${item.classCode}`);
    content.append(description, meta);
    article.append(code, content);
    return article;
  }

  function render() {
    const query = search.value.trim();
    const normalizedQuery = normalize(query);
    const compactQuery = normalizedQuery.replace(/\W/g, '');
    const selectedSection = section.value;

    matches = indexed.filter((item) => {
      const inSection = !selectedSection || item.section === selectedSection;
      if (!inSection || !normalizedQuery) return inSection;
      return item.searchable.includes(normalizedQuery) || item.code.replace(/\W/g, '').toLowerCase().includes(compactQuery);
    });

    list.replaceChildren(...matches.slice(0, limit).map((item) => resultCard(item, query)));
    const shown = Math.min(limit, matches.length);
    status.textContent = matches.length === 1 ? '1 znaleziony kod' : `${matches.length} znalezionych kodów`;
    empty.hidden = matches.length !== 0;
    more.hidden = shown >= matches.length;
    more.textContent = `Pokaż więcej (${matches.length - shown})`;
    clear.hidden = !query;
  }

  function resetLimitAndRender() { limit = pageSize; render(); }
  search.addEventListener('input', resetLimitAndRender);
  section.addEventListener('change', resetLimitAndRender);
  clear.addEventListener('click', () => { search.value = ''; search.focus(); resetLimitAndRender(); });
  more.addEventListener('click', () => { limit += pageSize; render(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== search) {
      event.preventDefault();
      search.focus();
    }
  });

  render();
})();
