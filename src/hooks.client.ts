import * as Sentry from "@sentry/sveltekit";
import type { ClientInit } from "@sveltejs/kit/hooks";

import * as config from "./sentry.config";

// No Session Replay: masked names keep their length and clicks keep their position in the roster,
// so a recording would still reveal the ranking.
export const init: ClientInit = () => {
  Sentry.init({
    ...config,
    integrations: [
      Sentry.consoleLoggingIntegration(),
      // Click breadcrumbs record aria-labels such as "Adicionar <candidato>", i.e. the ranking.
      Sentry.breadcrumbsIntegration({ dom: false }),
    ],
  });
};

export const handleError = Sentry.handleErrorWithSentry();
