import type { ReactNode } from "react";
import { IntlProvider, type AbstractIntlMessages } from "use-intl";

// Fixed zone so server and client format dates identically (matches the profile default).
export const DEFAULT_TIME_ZONE = "Asia/Dhaka";

export function AppIntlProvider({
    locale,
    messages,
    timeZone = DEFAULT_TIME_ZONE,
    children,
}: {
    locale: string;
    messages: AbstractIntlMessages;
    timeZone?: string;
    children: ReactNode;
}) {
    return (
        <IntlProvider locale={locale} messages={messages} timeZone={timeZone}>
            {children}
        </IntlProvider>
    );
}
