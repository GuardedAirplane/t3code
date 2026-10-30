import { render } from "../../../test/render";
import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { DEFAULT_UNIFIED_SETTINGS, type UnifiedSettings } from "@t3tools/contracts/settings";
import { type ReactNode } from "react";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import "../../index.css";
import type { ScopedSettingsPatch } from "./scopedSettings";

const state = vi.hoisted(() => ({
  settings: {} as UnifiedSettings,
  providers: [] as ServerProvider[],
  updateSettings: vi.fn<(patch: ScopedSettingsPatch) => void>(),
}));

vi.mock(import("@tanstack/react-router"), async (original) => ({
  ...(await original()),
  useNavigate: (() => vi.fn()) as never,
}));
vi.mock(import("./useScopedSettings"), async (original) => ({
  ...(await original()),
  useScopedSettings: (() => state.settings) as never,
  useScopedSettingsMixed: () => false,
  useScopedSettingSource: (() => "environment") as never,
  useUpdateScopedSettings: () => state.updateSettings,
}));
vi.mock(import("./SettingsScopeContext"), async (original) => ({
  ...(await original()),
  useSettingsScope: (() => {
    const environment = { environmentId: "env", label: "Workstation", serverConfig: {} };
    return {
      scope: { kind: "environment" },
      environments: [environment],
      connectedEnvironments: [environment],
      targets: [],
      target: { environmentId: "env", projectId: null, settings: state.settings },
    };
  }) as never,
}));
vi.mock(import("../../state/environments"), async (original) => ({
  ...(await original()),
  useEnvironments: (() => ({
    environments: [{ environmentId: "env", label: "Workstation", serverConfig: {} }],
  })) as never,
  useEnvironmentProviders: () => new Map([[EnvironmentId.make("env"), state.providers]]),
}));
vi.mock(import("./settingsLayout"), async (original) => ({
  ...(await original()),
  SettingsRow: (({ id, title, control }: { id: string; title: string; control: ReactNode }) => (
    <div data-testid={id}>
      <h3>{title}</h3>
      {control}
    </div>
  )) as never,
  SettingsSection: (({ children }: { children: ReactNode }) => children) as never,
}));

import { ProjectDefaultsSettings } from "./ProjectDefaultsSettings";

const CODEX = ProviderInstanceId.make("codex");

function codexModel(slug: string) {
  return {
    slug,
    name: slug,
    isCustom: false,
    capabilities: {
      optionDescriptors: [
        {
          id: "reasoningEffort",
          label: "Reasoning effort",
          type: "select" as const,
          options: [
            { id: "low", label: "Low", isDefault: true },
            { id: "medium", label: "Medium" },
            { id: "high", label: "High" },
          ],
        },
      ],
    },
  };
}

function setup() {
  state.providers = [
    {
      instanceId: CODEX,
      driver: ProviderDriverKind.make("codex"),
      enabled: true,
      installed: true,
      version: null,
      status: "ready",
      auth: { status: "authenticated" },
      checkedAt: "2026-01-01T00:00:00.000Z",
      models: [codexModel("gpt-6-astra"), codexModel("gpt-6.1-sol")],
      slashCommands: [],
      skills: [],
    },
  ];
  state.settings = {
    ...DEFAULT_UNIFIED_SETTINGS,
    defaultModelSelection: { instanceId: CODEX, model: "gpt-6-astra" },
    fallbackModelSelection: { instanceId: CODEX, model: "gpt-6.1-sol" },
  };
  state.updateSettings.mockReset();
}

it("saves a reasoning effort chosen for the fallback model", async () => {
  setup();
  await using _screen = await render(<ProjectDefaultsSettings category="general" />);
  const fallbackEffort = page.getByTestId("fallback-model").getByRole("button", { name: "Low" });

  await expect.element(fallbackEffort).toBeVisible();
  await userEvent.click(fallbackEffort);
  await userEvent.click(page.getByRole("menuitemradio", { name: "High" }));

  expect(state.updateSettings).toHaveBeenCalledWith({
    fallbackModelSelection: {
      instanceId: CODEX,
      model: "gpt-6.1-sol",
      options: [{ id: "reasoningEffort", value: "high" }],
    },
  });
});
