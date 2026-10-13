import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: Props) => <div className="dark">{children}</div>;