import type { ServerSettingsPatch } from "@t3tools/contracts";
import { useEffect, useEffectEvent, useRef } from "react";
import { View } from "react-native";

import { AppText as Text, AppTextInput } from "../../../components/ui/AppText";
import { SettingsSection } from "./SettingsSection";

export function FileAttachmentLimitSetting(props: {
  /** Megabytes, or null when the selected environments differ. */
  limitMb: number | null;
  disabled: boolean;
  footer: string | undefined;
  onChange: (patch: ServerSettingsPatch) => void;
}) {
  // Save on exit too: Android Back hides the keyboard without ending editing.
  const draft = useRef<{ text: string; over: number | null } | null>(null);
  // Drop a draft typed over an older saved value: the updated value has already remounted the input.
  const take = (): ServerSettingsPatch => {
    const current = draft.current;
    draft.current = null;
    if (current === null || current.over !== props.limitMb) return {};
    const text = current.text.trim();
    const value = Number(text);
    return text !== "" && Number.isInteger(value) && value >= 0 && value !== props.limitMb
      ? { fileAttachmentLimitMb: value }
      : {};
  };
  const send = (patch: ServerSettingsPatch) => {
    if (Object.keys(patch).length > 0) props.onChange(patch);
  };
  const saveDraft = useEffectEvent(() => send(take()));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- saves an unsent limit to server settings when the section unmounts
  useEffect(() => () => saveDraft(), []);
  return (
    <SettingsSection
      title="File attachment limit"
      footer={props.footer}
      trailing={
        props.limitMb === null ? <Text className="text-xs text-foreground-muted">Mixed</Text> : null
      }
    >
      <View className="gap-2 px-4 py-3">
        <Text className="text-sm text-foreground-muted">
          The largest file, in MB, that can be attached. 0 removes the limit. Files over 50 MB can
          upload slowly, and older T3 Code apps can't open threads that contain them.
        </Text>
        <AppTextInput
          key={props.limitMb ?? "mixed"}
          accessibilityLabel="File attachment limit in MB"
          keyboardType="number-pad"
          defaultValue={props.limitMb === null ? "" : String(props.limitMb)}
          placeholder={props.limitMb === null ? "Mixed" : undefined}
          editable={!props.disabled}
          className="min-h-10 rounded-xl px-3 py-2 text-base text-foreground"
          onChangeText={(text) => {
            draft.current = { text, over: props.limitMb };
          }}
          onEndEditing={() => send(take())}
        />
      </View>
    </SettingsSection>
  );
}
