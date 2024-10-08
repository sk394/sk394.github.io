"use client";

import Link from "next/link";
import React, { useState } from "react";
import { Card, CardHeader } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Markdown from "react-markdown";

interface ResumeCardProps {
  logoUrl: string;
  altText: string;
  title: string;
  subtitle?: string;
  href?: string;
  badges?: readonly string[];
  period: string;
  description?: string;
}

export function ResumeCard({
  logoUrl,
  altText,
  title,
  subtitle,
  href,
  badges,
  period,
  description,
}: ResumeCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (description) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <Link
      href={href || "#"}
      className="block cursor-pointer"
      onClick={handleClick}
    >
      <Card className="border-none">
        <div className="flex items-center">
          <Avatar className="bg-muted-background m-auto size-12  dark:bg-foreground">
            <AvatarImage
              src={logoUrl}
              alt={altText}
              className="object-contain"
            />
            <AvatarFallback>{altText[0]}</AvatarFallback>
          </Avatar>

          <div className=" ml-4 flex-grow ">
            <CardHeader className="p-0">
              <div className="flex items-center justify-between gap-x-2 text-base">
                <h3 className="inline-flex items-center justify-center text-xs font-semibold leading-none sm:text-sm">
                  {title}
                  {badges && (
                    <span className="ml-2 inline-flex gap-x-1">
                      {badges.map((badge, index) => (
                        <Badge
                          variant="secondary"
                          className="align-middle text-xs"
                          key={index}
                        >
                          {badge}
                        </Badge>
                      ))}
                    </span>
                  )}
                  <ChevronRightIcon
                    className={cn(
                      "h-4 w-4 ml-1 translate-x-0 group-hover:translate-x-1 ease-out ",
                      isExpanded ? "rotate-90" : "rotate-0"
                    )}
                  />
                </h3>

                <div className="text-right text-xs tabular-nums text-muted-foreground sm:text-sm">
                  {period}
                </div>
              </div>
              {subtitle && <div className="font-sans text-xs">{subtitle}</div>}
            </CardHeader>
            {description && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{
                  opacity: isExpanded ? 1 : 0,
                  height: isExpanded ? "auto" : 0,
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="mt-2 text-xs sm:text-sm"
              >
                <Markdown className="prose text-pretty text-xs dark:prose-invert space-y-0.5">
                  {description}
                </Markdown>
              </motion.div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
