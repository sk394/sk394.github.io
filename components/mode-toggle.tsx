"use client";

import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      type="button"
      size="icon"
      className="size-12"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="size-8 dark:hidden dark:text-neutral-200 text-yellow-600" />
      <MoonIcon className="hidden size-8 text-neutral-800 dark:block dark:text-neutral-200" />
    </Button>
  );
}
