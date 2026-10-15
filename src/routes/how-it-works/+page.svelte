<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
</script>

<svelte:head>
  <title>{m.method_title()} · {m.app_title()}</title>
</svelte:head>

<article class="education-page">
  <h1>{m.method_title()}</h1>
  <p>{m.simulation_warning()}</p>
  <p>{m.method_intro()}</p>

  <section>
    <h2>{m.method_winner_title()}</h2>
    <p>{m.method_winner_body()}</p>
  </section>

  <section>
    <h2>{m.method_paradox_title()}</h2>
    <p>{m.method_paradox_body()}</p>
  </section>

  <section>
    <h2>{m.method_plurality_title()}</h2>
    <p>{m.method_plurality_body()}</p>
  </section>

  <section>
    <h2>{m.method_runoff_title()}</h2>
    <p>{m.method_runoff_body()}</p>
  </section>

  <section>
    <h2>{m.method_example_title()}</h2>
    <p>{m.method_example_body()}</p>
  </section>

  <section>
    <h2>{m.method_limits_title()}</h2>
    <p>{m.method_limits_body()}</p>
  </section>

  <section id="comparison-methods" class="method-grid" aria-label={m.method_title()}>
    <div class="method-card">
      <h2>{m.education_copeland_title()}</h2>
      <p>{m.education_copeland_body()}</p>
    </div>
    <div class="method-card">
      <h2>{m.education_schulze_title()}</h2>
      <p>{m.education_schulze_body()}</p>
    </div>
    <div class="method-card">
      <h2>{m.education_ranked_pairs_title()}</h2>
      <p>{m.education_ranked_pairs_body()}</p>
    </div>
  </section>

  <section class="method-limit-note">
    <h2>{m.education_method_ties_title()}</h2>
    <p>{m.education_method_ties_body()}</p>
  </section>

  <section class="source-list">
    <h2>{m.method_sources()}</h2>
    <ul>
      <li>
        <a
          href="https://g1.globo.com/politica/eleicoes/2026/noticia/2026/10/04/quais-sao-os-numeros-dos-candidatos-a-presidencia-nas-eleicoes-2026.ghtml"
          >g1.globo.com</a
        >
      </li>
      <li>
        <a
          href="https://valor.globo.com/politica/eleicoes-2026/noticia/2026/09/30/candidatos-a-presidente-em-2026-quem-sao-numeros-e-partidos.ghtml"
          >valor.globo.com</a
        >
      </li>
      <li>
        <a
          href="https://sintse.tse.jus.br/documentos/2026/Set/18/diario-da-justica-eletronico-tse/lista-de-candidatas-e-candidatos-aos-cargos-de-presidente-e-vice-presidente-da-republica"
          >sintse.tse.jus.br</a
        >
      </li>
      <li><a href="https://plato.stanford.edu/entries/voting-methods/">plato.stanford.edu</a></li>
      <li>
        <a href="https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm"
          >planalto.gov.br</a
        >
      </li>
    </ul>
  </section>
</article>
