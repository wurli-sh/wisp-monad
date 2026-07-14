"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const SAMPLES = ["@maria", "kyle@gmail.com", "@stellar_dev"];

export function HeroSendBox() {
  const [to, setTo] = useState("");
  const [placeholder, setPlaceholder] = useState("@handle or email");
  const router = useRouter();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let word = 0;
    let len = 0;
    let deleting = false;
    let t: ReturnType<typeof setTimeout>;

    const step = () => {
      const sample = SAMPLES[word];
      if (!deleting && len < sample.length) {
        len += 1;
      } else if (!deleting) {
        deleting = true;
        t = setTimeout(step, 1800);
        return;
      } else if (len > 0) {
        len -= 1;
      } else {
        deleting = false;
        word = (word + 1) % SAMPLES.length;
      }
      setPlaceholder(sample.slice(0, len) || "@handle or email");
      t = setTimeout(step, deleting ? 40 : 90);
    };

    t = setTimeout(step, 1200);
    return () => clearTimeout(t);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = to.trim();
    if (!trimmed) return;
    router.push(`/send?to=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-md gap-2 sm:max-w-xl"
    >
      <input
        type="text"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder={placeholder}
        aria-label="Recipient"
        autoComplete="off"
        className="w-full flex-1 rounded-full border-2 border-border bg-card px-5 py-3.5 text-lg outline-none placeholder:text-muted-foreground/60 focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
      <Button type="submit" size="lg" className="shrink-0 sm:px-7">
        Pay
      </Button>
    </form>
  );
}
