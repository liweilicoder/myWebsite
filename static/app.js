const state = { article: null, articles: [], pages: [], page: 0, request: 0 };
const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function withFootnoteLinks(text) {
  return escapeHtml(text).replace(/〔(\d+)〕/g, '<sup class="footnote-ref">$1</sup>');
}

function paginate(blocks) {
  if (window.matchMedia('(max-width: 720px)').matches) {
    return [[blocks]];
  }

  const leaves = [];
  let leaf = [];
  const measure = document.createElement('div');
  measure.className = 'book-spread pagination-measure';
  measure.setAttribute('aria-hidden', 'true');
  measure.innerHTML = '<section class="book-page"><div class="leaf-content"></div></section>';
  $('#cards').append(measure);

  const page = measure.querySelector('.book-page');
  const content = measure.querySelector('.leaf-content');
  const pageStyle = getComputedStyle(page);
  const availableHeight = page.clientHeight
    - Number.parseFloat(pageStyle.paddingTop)
    - Number.parseFloat(pageStyle.paddingBottom)
    - 14;

  const addBlock = (block) => {
    const previous = leaf[leaf.length - 1];
    if (block.kind === 'paragraph' && previous && previous.paragraphIndex === block.paragraphIndex) {
      content.lastElementChild.insertAdjacentHTML('beforeend', withFootnoteLinks(block.text));
      return;
    }
    const element = document.createElement(block.kind === 'heading' ? 'h2' : block.kind === 'quote' ? 'blockquote' : 'p');
    element.innerHTML = withFootnoteLinks(block.text);
    content.append(element);
  };

  for (const [paragraphIndex, originalBlock] of blocks.entries()) {
    const pieces = originalBlock.kind === 'paragraph'
      ? (originalBlock.text.match(/.{1,18}/gu) || ['']).map((text) => ({
        ...originalBlock,
        text,
        paragraphIndex,
      }))
      : [originalBlock];
    for (const block of pieces) {
      addBlock(block);
      const overflows = content.scrollHeight > availableHeight;
      const headingNeedsBody = leaf.length === 1 && leaf[0].kind === 'heading';
      if (leaf.length && overflows && !headingNeedsBody) {
        leaves.push(leaf);
        leaf = [];
        content.innerHTML = '';
        addBlock(block);
      }
      leaf.push(block);
    }
  }
  measure.remove();
  if (leaf.length) leaves.push(leaf);
  if (!leaves.length) leaves.push([{ kind: 'paragraph', text: '此篇文章暂无可显示的正文。' }]);
  return Array.from({ length: Math.ceil(leaves.length / 2) }, (_, index) => leaves.slice(index * 2, index * 2 + 2));
}

function renderLeaf(blocks, pageNumber) {
  if (!blocks) return '<section class="book-page book-page-empty"><span>—</span><small>全文至此</small></section>';
  const content = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.kind === 'paragraph') {
      let text = block.text;
      while (
        index + 1 < blocks.length
        && blocks[index + 1].paragraphIndex === block.paragraphIndex
      ) {
        text += blocks[index + 1].text;
        index += 1;
      }
      content.push(`<p>${withFootnoteLinks(text)}</p>`);
      continue;
    }
    if (block.kind === 'heading') content.push(`<h2>${withFootnoteLinks(block.text)}</h2>`);
    if (block.kind === 'quote') content.push(`<blockquote>${withFootnoteLinks(block.text)}</blockquote>`);
  }
  return `<section class="book-page">
    <span class="leaf-number">${String(pageNumber).padStart(2, '0')}</span>
    <div class="leaf-content">${content.join('')}</div>
  </section>`;
}

function renderToc() {
  $('#toc-list').innerHTML = state.articles.map((article) => `
    <button class="toc-item ${state.article && article.id === state.article.id ? 'active' : ''}" data-article-id="${escapeHtml(article.id)}"${state.article && article.id === state.article.id ? ' aria-current="page"' : ''}>
      <span>${escapeHtml(article.id)}</span>${escapeHtml(article.title)}
    </button>`).join('');
}

function goToPage(page) {
  state.page = page;
  renderPage();
  $('.reader-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPage() {
  const spread = state.pages[state.page];
  const firstLeaf = state.page * 2 + 1;
  const totalLeaves = state.pages.reduce((total, page) => total + page.length, 0);
  $('#cards').innerHTML = `<div class="book-spread" style="--spread-index:${state.page}">
    ${renderLeaf(spread[0], firstLeaf)}
    ${renderLeaf(spread[1], firstLeaf + 1)}
  </div>`;
  const range = spread[1] ? `${String(firstLeaf).padStart(2, '0')}—${String(firstLeaf + 1).padStart(2, '0')}` : String(firstLeaf).padStart(2, '0');
  $('#page-counter').textContent = `${range} / ${String(totalLeaves).padStart(2, '0')}`;
  $('#prev-page').disabled = state.page === 0;
  $('#next-page').disabled = state.page === state.pages.length - 1;
  $('#page-dots').innerHTML = state.pages.map((_, index) => `<button class="dot ${index === state.page ? 'active' : ''}" aria-label="第 ${index + 1} 页" data-page="${index}"></button>`).join('');
  document.querySelectorAll('.dot').forEach((dot) => dot.addEventListener('click', () => {
    goToPage(Number(dot.dataset.page));
  }));
  renderToc();
}

function renderNotes(notes) {
  if (!notes.length) {
    $('#notes-section').hidden = true;
    return;
  }
  $('#notes-section').hidden = false;
  $('#notes').innerHTML = notes.map((note) => `
    <article class="note"><span class="note-number">${note.number}</span><p>${escapeHtml(note.text)}</p></article>`).join('');
}

function renderArticle(article) {
  state.article = article;
  state.pages = paginate(article.body);
  state.page = 0;
  $('#article-id').textContent = `ESSAY · ${article.id}`;
  $('#article-title').textContent = article.title;
  $('#article-date').textContent = article.date;
  $('#article-intro').textContent = article.notes.length ? `本篇附有 ${article.notes.length} 条注释，可在文末查阅。` : '每一次进入，随机遇见一篇文字。';
  renderNotes(article.notes);
  renderPage();
}

async function loadArticle(path, scrollToReader = false) {
  const request = ++state.request;
  $('#cards').innerHTML = $('#loading-template').innerHTML;
  $('#random-button').disabled = true;
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error('无法读取本地文章');
    const article = await response.json();
    if (request !== state.request) return;
    renderArticle(article);
    if (scrollToReader) $('.reader-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    if (request !== state.request) return;
    $('#cards').innerHTML = `<div class="error-card">${escapeHtml(error.message)}。请确认服务从项目根目录启动。</div>`;
  } finally {
    if (request === state.request) $('#random-button').disabled = false;
  }
}

async function loadArticles() {
  try {
    const response = await fetch('/api/articles', { cache: 'no-store' });
    if (!response.ok) throw new Error('无法读取文章目录');
    state.articles = await response.json();
    renderToc();
  } catch (error) {
    $('#toc-list').innerHTML = `<p class="toc-empty">${escapeHtml(error.message)}</p>`;
  }
}

function loadRandom() {
  return loadArticle('/api/random');
}

$('#prev-page').addEventListener('click', () => {
  if (state.page) goToPage(state.page - 1);
});
$('#next-page').addEventListener('click', () => {
  if (state.page < state.pages.length - 1) goToPage(state.page + 1);
});
$('#toc-list').addEventListener('click', (event) => {
  const item = event.target.closest('.toc-item');
  if (item && (!state.article || item.dataset.articleId !== state.article.id)) {
    loadArticle(`/api/article/${encodeURIComponent(item.dataset.articleId)}`, true);
  }
});
$('#random-button').addEventListener('click', loadRandom);
loadArticles();
loadRandom();
