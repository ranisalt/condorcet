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
  "home_eyebrow",
  "home_intro",
  "preference_illustration_label",
  "preference_first",
  "preference_first_hint",
  "preference_second",
  "preference_second_hint",
  "preference_third",
  "preference_third_hint",
  "preference_caption",
  "progress_title",
  "progress_count",
  "progress_open",
  "progress_closed",
  "progress_met",
  "progress_remaining",
  "progress_met_notice",
  "progress_locked_title",
  "progress_locked_body",
  "progress_label",
  "home_steps_title",
  "home_step_one_title",
  "home_step_one_body",
  "home_step_two_title",
  "home_step_two_body",
  "home_step_three_title",
  "home_step_three_body",
  "study_notice_title",
  "privacy_heading",
  "privacy_obfuscation",
  "ballot_unsaved_status",
  "ballot_changes_notice",
  "ballot_saving_status",
  "ballot_readonly_heading",
  "ballot_readonly_body",
  "education_copeland_title",
  "education_copeland_body",
  "education_schulze_title",
  "education_schulze_body",
  "education_ranked_pairs_title",
  "education_ranked_pairs_body",
  "education_method_ties_title",
  "education_method_ties_body",
  "results_intro",
  "results_locked_title",
  "results_strict_label",
  "results_strict_winner_description",
  "results_no_strict_winner",
  "results_comparison_title",
  "results_comparison_description",
  "results_method_navigation",
  "results_method_outcome",
  "results_method_result",
  "results_copeland",
  "results_copeland_description",
  "results_schulze",
  "results_schulze_description",
  "results_ranked_pairs",
  "results_ranked_pairs_description",
  "results_tied_title",
  "results_unresolved_title",
  "results_unresolved_description",
  "results_method_help",
  "results_margin_description",
  "results_margin_legend",
] as const;

it("provides the complete nonempty Portuguese interaction and education catalog", () => {
  const catalog = new Map(Object.entries(messages));
  const expectedKeys = ["$schema", ...requiredKeys].sort();
  expect([...catalog.keys()].sort()).toEqual(expectedKeys);
  expect(messages.$schema).toBe("https://inlang.com/schema/inlang-message-format");
  for (const key of requiredKeys) expect(catalog.get(key), key).toBeTruthy();
  expect([...catalog.values()].every((value) => value.trim().length > 0)).toBe(true);
  expect(catalog.has("hello_world")).toBe(false);
});

it("keeps the simulation, privacy, and login warnings exact", () => {
  expect(messages.simulation_warning).toBe(
    "Esta é uma simulação para fins de estudo. Não é uma eleição oficial, não representa uma pesquisa eleitoral e seus resultados não refletem a realidade.",
  );
  expect(messages.privacy_warning).toBe(
    "Seu voto não é anônimo: ele fica associado à sua conta no banco de dados e pode ser identificado pelo operador do serviço. A Cloudflare, que hospeda o serviço, também pode ter acesso aos dados. Não utilize este serviço se deseja manter suas preferências políticas em segredo.",
  );
  expect(messages.login_explanation).toBe(
    "O acesso é feito apenas pelo Google para reduzir envios repetidos por conta. Isso não garante uma pessoa por voto: uma pessoa pode usar várias contas. Não há cadastro por senha.",
  );
  expect(messages.thanks_title).toBe("Cédula registrada");
  expect(messages.omitted_rule).toBe(
    "Candidaturas não selecionadas ficam empatadas em último lugar, abaixo de todas as candidaturas que você selecionou.",
  );
  expect(messages.empty_rule).toContain("Votos em branco não contam como participação válida");
  expect(messages.empty_rule).toContain("não entram nos cálculos");
  expect(messages.privacy_obfuscation).toContain("não são criptografia");
  expect(messages.privacy_obfuscation).toContain("associação entre voto e candidatura");
});

it("explains the three methods, tied outcomes, and unresolved exploration directly", () => {
  expect(messages.education_copeland_body).toContain("vitórias menos derrotas");
  expect(messages.education_schulze_body).toContain("caminho mais forte");
  expect(messages.education_ranked_pairs_body).toContain("margem");
  expect(messages.education_ranked_pairs_body).toContain("votos vencedores");
  expect(messages.education_method_ties_body).toContain("todas as ordens empatadas");
  expect(messages.education_method_ties_body).toContain("exploração");
});
