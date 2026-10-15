import { expect, it } from "vitest";
import messages from "../../messages/pt-br.json";

const requiredKeys = [
  "app_title",
  "election_br_2026_title",
  "nav_home",
  "nav_method",
  "nav_ballot",
  "nav_results",
  "simulation_warning",
  "privacy_warning",
  "login_explanation",
  "sign_in",
  "sign_out",
  "start_ballot",
  "valid_participation",
  "results_threshold",
  "no_election",
  "election_closed",
  "ack_title",
  "ack_label",
  "ack_continue",
  "ack_required",
  "ballot_title",
  "ranked_title",
  "unranked_title",
  "omitted_rule",
  "empty_rule",
  "save_rule",
  "vice_label",
  "add_candidate",
  "remove_candidate",
  "move_up_candidate",
  "move_down_candidate",
  "rank_label",
  "ranked_empty",
  "unranked_empty",
  "cast_vote",
  "saving_vote",
  "invalid_ballot",
  "stale_election",
  "save_failed",
  "login_failed",
  "thanks_title",
  "thanks_saved",
  "thanks_blank",
  "edit_vote",
  "results_title",
  "results_not_submitted",
  "results_below_threshold",
  "blank_stat",
  "condorcet_winner",
  "no_condorcet_winner",
  "pairwise_caption",
  "pairwise_explanation",
  "pairwise_row_label",
  "pairwise_cell",
  "method_title",
  "method_intro",
  "method_winner_title",
  "method_winner_body",
  "method_paradox_title",
  "method_paradox_body",
  "method_plurality_title",
  "method_plurality_body",
  "method_runoff_title",
  "method_runoff_body",
  "method_example_title",
  "method_example_body",
  "method_limits_title",
  "method_limits_body",
  "method_sources",
  "skip_to_content",
  "main_navigation",
  "unexpected_error",
] as const;

it("provides the complete nonempty Portuguese interaction and education catalog", () => {
  const catalog = new Map(Object.entries(messages));
  const expectedKeys = ["$schema", ...requiredKeys, "hello_world"].sort();
  expect([...catalog.keys()].sort()).toEqual(expectedKeys);
  expect(messages.$schema).toBe("https://inlang.com/schema/inlang-message-format");
  for (const key of requiredKeys) expect(catalog.get(key), key).toBeTruthy();
  expect([...catalog.values()].every((value) => value.trim().length > 0)).toBe(true);
  // The root welcome page is still owned by another task and temporarily consumes this starter key.
  expect(messages.hello_world).toBe("Hello, {name} from pt-br!");
});

it("keeps the simulation, privacy, and login warnings exact", () => {
  expect(messages.simulation_warning).toBe(
    "Esta é uma simulação para fins de estudo. Não é uma eleição oficial, não representa uma pesquisa eleitoral e seus resultados não refletem a realidade.",
  );
  expect(messages.privacy_warning).toBe(
    "Seu voto não é anônimo: ele fica associado à sua conta no banco de dados e pode ser identificado pelo operador do serviço. A Cloudflare, que hospeda o serviço, também pode ter acesso aos dados. Não utilize este serviço se deseja manter suas preferências políticas em segredo.",
  );
  expect(messages.login_explanation).toBe(
    "Usamos apenas o login com Google para reduzir votos repetidos por conta. Isso não garante uma pessoa por voto: uma pessoa pode ter várias contas. Não oferecemos cadastro com senha.",
  );
  expect(messages.omitted_rule).toBe(
    "Candidaturas não selecionadas ficam empatadas em último lugar, abaixo de todas as candidaturas que você selecionou.",
  );
});
