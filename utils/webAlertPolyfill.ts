import { Alert, Platform } from 'react-native';

let installed = false;

export function installWebAlertPolyfill(): void {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  installed = true;

  const alertObject = Alert as typeof Alert & {
    alert: (
      title: string,
      message?: string,
      buttons?: Array<{ text?: string; onPress?: (value?: string) => void; style?: string }>,
      options?: unknown
    ) => void;
  };

  alertObject.alert = (title, message = '', buttons = []) => {
    const body = [title, message].filter(Boolean).join('\n\n');

    if (!buttons || buttons.length === 0) {
      window.alert(body);
      return;
    }

    const cancel = buttons.find(button => button.style === 'cancel');
    const actionable = buttons.filter(button => button !== cancel);

    if (actionable.length <= 1) {
      const action = actionable[0];
      if (!action) {
        window.alert(body);
        cancel?.onPress?.();
        return;
      }
      const confirmed = window.confirm(body);
      if (confirmed) action.onPress?.();
      else cancel?.onPress?.();
      return;
    }

    const labels = actionable
      .map((button, index) => `${index + 1}. ${button.text ?? `אפשרות ${index + 1}`}`)
      .join('\n');
    const raw = window.prompt(`${body}\n\n${labels}\n\nהקלד מספר אפשרות:`);
    if (raw == null) {
      cancel?.onPress?.();
      return;
    }
    const index = Number.parseInt(raw, 10) - 1;
    const action = actionable[index];
    if (action) action.onPress?.();
    else window.alert('בחירה לא תקינה.');
  };
}
