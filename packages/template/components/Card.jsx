// import Link from 'next/link'
import clsx from "clsx";
import { ChevronRightIcon } from "@/components/ChevronRightIcon.jsx";
import { initialsFromName } from "@/lib/initialsFromName.js";

export function Card({ as: Component = "div", className, children }) {
  return (
    <Component
      className={clsx(className, "group relative flex flex-col items-start")}
    >
      {children}
    </Component>
  );
}

Card.Link = function CardLink({ children, ...props }) {
  // <Link {...props}>
  //   <span className="absolute -inset-y-6 -inset-x-4 z-20 sm:-inset-x-6 sm:rounded-2xl" />
  //   <span className="relative z-10">{children}</span>
  // </Link>
  return (
    <>
      <div className="absolute -inset-y-6 -inset-x-4 z-0 scale-95 bg-zinc-50 opacity-0 transition group-hover:scale-100 group-hover:opacity-100 dark:bg-slate-800/75 sm:-inset-x-6 sm:rounded-2xl" />
      <a {...props}>
        <span className="absolute -inset-y-6 -inset-x-4 z-20 sm:-inset-x-6 sm:rounded-2xl" />
        <span className="relative z-10">{children}</span>
      </a>
    </>
  );
};

Card.Title = function CardTitle({ as: Component = "h2", href, children }) {
  return (
    <Component className="text-base font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
      {href ? <Card.Link href={href}>{children}</Card.Link> : children}
    </Component>
  );
};

Card.Description = function CardDescription({ children }) {
  return (
    <p className="relative z-10 mt-2 text-sm text-zinc-600 dark:text-zinc-400">
      {children}
    </p>
  );
};

Card.Cta = function CardCta({ children }) {
  return (
    <div
      aria-hidden="true"
      className="relative z-10 mt-4 flex items-center text-sm font-medium text-teal-500"
    >
      {children}
      <ChevronRightIcon className="ml-1 h-4 w-4 stroke-current" />
    </div>
  );
};

Card.Avatar = function CardAvatar({ name, src, href }) {
  return (
    <a href={href} className="group block flex-shrink-0 mt-2">
      <div className="flex items-center">
        <div>
          {src ? (
            <img
              className="inline-block h-9 w-9 rounded-full"
              src={src}
              alt={name}
            />
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-500">
              <span className="text-xs font-medium leading-none text-white">
                {initialsFromName(name)}
              </span>
            </span>
          )}
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
            {name}
          </p>
        </div>
      </div>
    </a>
  );
};

Card.Eyebrow = function CardEyebrow({
  as: Component = "p",
  decorate = false,
  className,
  children,
  ...props
}) {
  return (
    <Component
      className={clsx(
        className,
        "relative z-10 order-first mb-3 flex items-center text-sm text-zinc-400 dark:text-zinc-500",
        decorate && "pl-3.5"
      )}
      {...props}
    >
      {decorate && (
        <span
          className="absolute inset-y-0 left-0 flex items-center"
          aria-hidden="true"
        >
          <span className="h-4 w-0.5 rounded-full bg-zinc-200 dark:bg-zinc-500" />
        </span>
      )}
      {children}
    </Component>
  );
};
