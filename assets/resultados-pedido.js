(function () {
  const DATA_URL = "./data/resultados-pedido.json";
  const PAGE_SIZE = 24;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  }

  function unique(items) {
    return [...new Set(items)].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true }),
    );
  }

  function option(value, label) {
    return `<option value="${escapeHtml(value)}">${escapeHtml(label || value)}</option>`;
  }

  function offerUrl(item) {
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.set("periodo", item.periodo);
    url.searchParams.set("curso", item.curso);
    url.searchParams.set("semestre", item.semestre);
    url.searchParams.set("disciplina", item.disciplina);
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  function resultRow(item) {
    const remaining =
      item.vagasRestantes === null ? "Não apurado" : item.vagasRestantes;
    return `
      <tr>
        <td data-label="Disciplina">
          <a class="results-discipline-link" href="${escapeHtml(offerUrl(item))}" data-offer-link aria-label="Ver horários e detalhes de ${escapeHtml(item.disciplina)}">
            <strong>${escapeHtml(item.disciplina)}</strong>
            <small>Ver horários e detalhes →</small>
          </a>
        </td>
        <td data-label="Período">${escapeHtml(item.periodo)}</td>
        <td data-label="Curso">${escapeHtml(item.curso)}</td>
        <td class="number" data-label="Semestre">${escapeHtml(item.semestre)}</td>
        <td class="number" data-label="Solicitações">${item.solicitacoes}</td>
        <td class="number" data-label="Aceitas">${item.aceitas}</td>
        <td class="number denied" data-zero="${item.negadas === 0}" data-label="Negadas">${item.negadas}</td>
        <td class="number remaining" data-label="Vagas restantes">${escapeHtml(remaining)}</td>
      </tr>`;
  }

  function buildSection(data) {
    const section = document.createElement("section");
    section.className = "section results-public-section";
    section.id = "resultado-pedido";
    section.setAttribute("aria-labelledby", "resultado-pedido-title");
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <p class="eyebrow">Processamento concluído</p>
          <h2 id="resultado-pedido-title">Resultado do Pedido de Matrícula</h2>
        </div>
        <div class="results-public-intro">
          <p>Consulte o resultado consolidado por disciplina. O resultado individual continua disponível no Q-Acadêmico.</p>
          <p><strong>Atualizado em ${escapeHtml(data.atualizadoEm)}</strong></p>
        </div>
      </div>
      <p class="results-public-note"><strong>Atenção:</strong> ${escapeHtml(data.observacao)}</p>
      <aside class="results-next-steps" aria-labelledby="results-next-steps-title">
        <div class="results-next-steps-heading">
          <p>O processo continua</p>
          <h3 id="results-next-steps-title">Este resultado não encerra a rematrícula</h3>
          <span>Se uma solicitação não foi atendida, acompanhe obrigatoriamente as próximas oportunidades.</span>
        </div>
        <div class="results-next-steps-grid">
          <article>
            <strong>Ajuste de Matrícula</strong>
            <span>21 a 26 de julho · Q-Acadêmico</span>
            <b>Resultado em 27/07, após as 10h</b>
          </article>
          <article>
            <strong>Ajuste Extraordinário</strong>
            <span>28 de julho a 9 de agosto · Q-Acadêmico</span>
            <b>Resultado em 10/08, após as 10h</b>
          </article>
          <article>
            <strong>Reajuste excepcional</strong>
            <span>10 e 11 de agosto · sistema SEI</span>
            <b>Casos excepcionais, sujeitos à análise</b>
          </article>
        </div>
      </aside>
      <div class="results-public-summary" aria-label="Resumo do processamento">
        <article><strong>${data.totais.disciplinas}</strong><span>disciplinas</span></article>
        <article><strong>${data.totais.solicitacoes}</strong><span>solicitações</span></article>
        <article><strong>${data.totais.aceitas}</strong><span>aceitas</span></article>
        <article><strong>${data.totais.negadas}</strong><span>negadas</span></article>
      </div>
      <div class="results-public-filters" aria-label="Filtros do resultado">
        <label><span>Período letivo</span><select data-filter="periodo"></select></label>
        <label><span>Curso</span><select data-filter="curso"></select></label>
        <label><span>Semestre</span><select data-filter="semestre"></select></label>
        <label><span>Buscar disciplina</span><input data-filter="busca" type="search" placeholder="Ex.: Língua Inglesa"></label>
      </div>
      <div class="results-public-bar" aria-live="polite">
        <p><strong data-results-count>0</strong> disciplinas encontradas</p>
        <button type="button" data-clear-results>Limpar filtros</button>
      </div>
      <div data-results-content></div>
    `;
    return section;
  }

  function attachPanel(data, section) {
    const periodSelect = section.querySelector('[data-filter="periodo"]');
    const courseSelect = section.querySelector('[data-filter="curso"]');
    const semesterSelect = section.querySelector('[data-filter="semestre"]');
    const searchInput = section.querySelector('[data-filter="busca"]');
    const count = section.querySelector("[data-results-count]");
    const content = section.querySelector("[data-results-content]");
    const clear = section.querySelector("[data-clear-results]");
    let limit = PAGE_SIZE;

    async function focusOffer(item) {
      const offersSection = document.getElementById("ofertas");
      if (!offersSection) return;

      const offerCourse =
        item.curso === "Técnico em Eventos"
          ? "Técnico em Eventos — EaD"
          : item.curso;
      const setValue = (control, value, eventName) => {
        if (!control) return;
        const descriptor = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(control),
          "value",
        );
        descriptor?.set.call(control, value);
        control.dispatchEvent(new Event(eventName, { bubbles: true }));
      };
      const wait = (duration = 60) =>
        new Promise((resolve) => window.setTimeout(resolve, duration));

      let controls = offersSection.querySelectorAll(".filters select");
      setValue(controls[0], item.periodo, "change");
      await wait();
      controls = offersSection.querySelectorAll(".filters select");
      setValue(controls[1], offerCourse, "change");
      await wait();
      controls = offersSection.querySelectorAll(".filters select");
      setValue(controls[2], item.semestre, "change");
      await wait();
      setValue(
        offersSection.querySelector('.filters input[type="search"]'),
        item.disciplina,
        "input",
      );
      await wait(100);

      const target = [...offersSection.querySelectorAll(".offer-card")].find(
        (card) =>
          !card.classList.contains("unavailable-card") &&
          normalize(card.querySelector("h3")?.textContent) ===
            normalize(item.disciplina),
      );
      (target || offersSection).scrollIntoView({
        behavior: "smooth",
        block: target ? "center" : "start",
      });
      if (target) {
        target.classList.remove("result-target-highlight");
        void target.offsetWidth;
        target.classList.add("result-target-highlight");
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        window.setTimeout(() => {
          target.classList.remove("result-target-highlight");
          target.removeAttribute("tabindex");
        }, 4200);
      }
    }

    periodSelect.innerHTML =
      option("Todos") +
      unique(data.resultados.map((item) => item.periodo))
        .map((value) => option(value))
        .join("");

    function updateDependentFilters() {
      const period = periodSelect.value;
      const currentCourse = courseSelect.value || "Todos";
      const availableCourses = unique(
        data.resultados
          .filter((item) => period === "Todos" || item.periodo === period)
          .map((item) => item.curso),
      );
      courseSelect.innerHTML =
        option("Todos") +
        availableCourses.map((value) => option(value)).join("");
      courseSelect.value = availableCourses.includes(currentCourse)
        ? currentCourse
        : "Todos";

      const currentSemester = semesterSelect.value || "Todos";
      const availableSemesters = unique(
        data.resultados
          .filter(
            (item) =>
              (period === "Todos" || item.periodo === period) &&
              (courseSelect.value === "Todos" ||
                item.curso === courseSelect.value),
          )
          .map((item) => item.semestre),
      );
      semesterSelect.innerHTML =
        option("Todos") +
        availableSemesters.map((value) => option(value)).join("");
      semesterSelect.value = availableSemesters.includes(currentSemester)
        ? currentSemester
        : "Todos";
    }

    function render() {
      updateDependentFilters();
      const query = normalize(searchInput.value);
      const filtered = data.resultados.filter(
        (item) =>
          (periodSelect.value === "Todos" ||
            item.periodo === periodSelect.value) &&
          (courseSelect.value === "Todos" ||
            item.curso === courseSelect.value) &&
          (semesterSelect.value === "Todos" ||
            item.semestre === semesterSelect.value) &&
          (!query || normalize(item.disciplina).includes(query)),
      );

      count.textContent = filtered.length;
      if (!filtered.length) {
        content.innerHTML =
          '<div class="results-public-empty">Nenhuma disciplina encontrada. Altere os filtros ou limpe a busca.</div>';
        return;
      }

      const visible = filtered.slice(0, limit);
      content.innerHTML = `
        <div class="results-public-table-wrap">
          <table class="results-public-table">
            <thead><tr>
              <th>Disciplina</th><th>Período</th><th>Curso</th><th>Semestre</th>
              <th>Solicitações</th><th>Aceitas</th><th>Negadas</th><th>Vagas restantes</th>
            </tr></thead>
            <tbody>${visible.map(resultRow).join("")}</tbody>
          </table>
        </div>
        ${visible.length < filtered.length ? `<button class="results-public-more" type="button" data-show-more>Mostrar mais ${Math.min(PAGE_SIZE, filtered.length - visible.length)}</button>` : ""}
      `;
      content
        .querySelector("[data-show-more]")
        ?.addEventListener("click", () => {
          limit += PAGE_SIZE;
          render();
        });
    }

    periodSelect.addEventListener("change", () => {
      limit = PAGE_SIZE;
      render();
    });
    courseSelect.addEventListener("change", () => {
      limit = PAGE_SIZE;
      render();
    });
    semesterSelect.addEventListener("change", () => {
      limit = PAGE_SIZE;
      render();
    });
    searchInput.addEventListener("input", () => {
      limit = PAGE_SIZE;
      render();
    });
    clear.addEventListener("click", () => {
      periodSelect.value = "Todos";
      courseSelect.value = "Todos";
      semesterSelect.value = "Todos";
      searchInput.value = "";
      limit = PAGE_SIZE;
      render();
    });
    content.addEventListener("click", (event) => {
      const link = event.target.closest("[data-offer-link]");
      if (!link) return;
      event.preventDefault();
      const row = link.closest("tr");
      const item = data.resultados.find(
        (candidate) =>
          candidate.periodo === row.children[1].textContent.trim() &&
          candidate.curso === row.children[2].textContent.trim() &&
          candidate.semestre === row.children[3].textContent.trim() &&
          normalize(candidate.disciplina) ===
            normalize(link.querySelector("strong").textContent),
      );
      if (!item) return;
      window.history.replaceState({}, "", offerUrl(item));
      focusOffer(item);
    });

    render();

    const params = new URLSearchParams(window.location.search);
    const linkedItem = data.resultados.find(
      (item) =>
        item.periodo === params.get("periodo") &&
        item.curso === params.get("curso") &&
        item.semestre === params.get("semestre") &&
        normalize(item.disciplina) === normalize(params.get("disciplina")),
    );
    if (linkedItem) window.setTimeout(() => focusOffer(linkedItem), 120);
  }

  function addEntryLinks() {
    const nav = document.querySelector(".site-header nav");
    if (nav && !nav.querySelector('[href="#resultado-pedido"]')) {
      const link = document.createElement("a");
      link.href = "#resultado-pedido";
      link.textContent = "Resultado";
      const stagesLink = nav.querySelector('[href="#etapas"]');
      nav.insertBefore(link, stagesLink || null);
    }

    const actions = document.querySelector(".hero-actions");
    if (actions && !actions.querySelector('[href="#resultado-pedido"]')) {
      const link = document.createElement("a");
      link.className = "button results-entry-button";
      link.href = "#resultado-pedido";
      link.textContent = "Ver resultado do pedido";
      actions.appendChild(link);
    }
  }

  async function initialize() {
    if (document.getElementById("resultado-pedido")) return true;
    const anchor = document.querySelector(".calendar-section");
    if (!anchor) return false;

    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(`Falha ao carregar resultados: ${response.status}`);
      const data = await response.json();
      const section = buildSection(data);
      anchor.insertAdjacentElement("afterend", section);
      addEntryLinks();
      attachPanel(data, section);
      return true;
    } catch (error) {
      console.warn(
        "Não foi possível carregar o resultado do Pedido de Matrícula.",
        error,
      );
      return true;
    }
  }

  async function boot() {
    if (await initialize()) return;
    const observer = new MutationObserver(async () => {
      if (await initialize()) observer.disconnect();
    });
    observer.observe(document.getElementById("root") || document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
