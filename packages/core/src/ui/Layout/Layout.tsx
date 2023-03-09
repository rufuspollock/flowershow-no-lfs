import { useEffect, useState } from "react";
import Head from "next/head.js";
import { NextRouter, useRouter } from "next/router.js";
import clsx from "clsx";

import { useTableOfContents } from "./useTableOfContents";
import { collectHeadings } from "../../utils";

import { Nav } from "../Nav";
import { SiteToc, NavItem, NavGroup } from "../SiteToc";
import { Comments, CommentsConfig } from "../Comments";
import { Footer } from "./Footer";
import { EditThisPage } from "./EditThisPage";
import { TableOfContents, TocSection } from "./TableOfContents";
import { NavConfig, ThemeConfig } from "../Nav";
import { AuthorConfig } from "../types";

interface Props extends React.PropsWithChildren {
  nav: NavConfig;
  author: AuthorConfig;
  theme: ThemeConfig;
  showToc: boolean;
  showEditLink: boolean;
  showSidebar: boolean;
  url_path: string;
  showComments: boolean;
  commentsConfig: CommentsConfig;
  edit_url?: string;
}

interface SearchPage {
  title?: string;
  url_path: string;
  slug: string;
  sourceDir: string;
}

export const Layout: React.FC<Props> = ({
  children,
  nav,
  author,
  theme,
  showEditLink,
  showToc,
  showSidebar,
  url_path,
  showComments,
  commentsConfig,
  edit_url,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [tableOfContents, setTableOfContents] = useState<TocSection[]>([]);
  const [sitemap, setSitemap] = useState<Array<NavItem | NavGroup>>([]);
  const currentSection = useTableOfContents(tableOfContents);
  const router: NextRouter = useRouter();

  useEffect(() => {
    if (!showToc) return;
    const headingNodes: NodeListOf<HTMLHeadingElement> =
      document.querySelectorAll("h1,h2,h3");
    const toc = collectHeadings(headingNodes);
    setTableOfContents(toc ?? []);
  }, [router.asPath, showToc]); // update table of contents on route change with next/link

  // TODO move
  useEffect(() => {
    if (!showSidebar) return;
    const fetchData = async () => {
      const res = await fetch("/search.json");
      const json: Array<SearchPage> = await res.json();

      // group pages by the top level dir only (content/<dir>)
      const pagesGroupedByDir: { [x: string]: Array<NavItem> } = json.reduce(
        (acc, curr) => {
          const key = curr.sourceDir ? curr.sourceDir.split("/")[0] : "_loose";
          if (!(key in acc)) {
            acc[key] = [];
          }
          acc[key].push({
            name: curr.title ?? curr.slug,
            href: curr.url_path,
          });
          return acc;
        },
        {}
      );

      let siteMap: Array<NavItem | NavGroup> = [];
      const groupedPages: Array<NavGroup> = [];

      for (const dir in pagesGroupedByDir) {
        // sort pages in a group in alphabetical order
        const pagesSorted: Array<NavItem> = [...pagesGroupedByDir[dir]].sort(
          (a, b) => a.name.localeCompare(b.name)
        );
        // add loose pages directly to the sitemap array
        if (dir === "_loose") {
          siteMap = siteMap.concat(pagesSorted);
        } else {
          groupedPages.push({
            name: dir,
            children: pagesSorted,
          });
        }
      }
      // sort groups alphabetically
      groupedPages.sort((a, b) => a.name.localeCompare(b.name));
      siteMap = siteMap.concat(groupedPages);
      console.log({ siteMap });
      setSitemap(siteMap);
    };
    fetchData();
  }, [showSidebar]);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      <Head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💐</text></svg>"
        />
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <div className="min-h-screen bg-background dark:bg-background-dark">
        {/* NAVBAR */}
        <div
          className={clsx(
            "sticky top-0 z-50 w-full",
            isScrolled
              ? "dark:bg-background-dark/95 bg-background/95 backdrop-blur [@supports(backdrop-filter:blur(0))]:dark:bg-background-dark/75"
              : "dark:bg-background-dark bg-background"
          )}
        >
          <div className="max-w-8xl mx-auto p-4 md:px-8">
            <Nav
              title={nav.title}
              logo={nav.logo}
              links={nav.links}
              search={nav.search}
              social={nav.social}
              defaultTheme={theme.defaultTheme}
              themeToggleIcon={theme.themeToggleIcon}
            >
              {showSidebar && <SiteToc currentPath={url_path} nav={sitemap} />}
            </Nav>
          </div>
        </div>
        {/* wrapper for sidebar, main content and ToC */}
        <div
          className={clsx(
            "max-w-8xl mx-auto px-4 md:px-8",
            showSidebar && "lg:ml-[18rem]",
            showToc && "xl:mr-[18rem]"
          )}
        >
          {/* SIDEBAR */}
          {showSidebar && (
            <div className="hidden lg:block fixed z-20 w-[18rem] top-[4.6rem] right-auto bottom-0 left-[max(0px,calc(50%-44rem))] p-8 overflow-y-auto">
              <SiteToc currentPath={url_path} nav={sitemap} />
            </div>
          )}
          {/* MAIN CONTENT & FOOTER */}
          <main className="mx-auto pt-8">
            {children}
            {/* EDIT THIS PAGE LINK */}
            {showEditLink && edit_url && <EditThisPage url={edit_url} />}
            {/* PAGE COMMENTS */}
            {showComments && (
              <div
                className="prose mx-auto pt-6 pb-6 text-center text-gray-700 dark:text-gray-300"
                id="comment"
              >
                {<Comments commentsConfig={commentsConfig} slug={url_path} />}
              </div>
            )}
          </main>
          <Footer links={nav.links} author={author} />
          {/** TABLE OF CONTENTS */}
          {showToc && tableOfContents.length > 0 && (
            <div className="hidden xl:block fixed z-20 w-[18rem] top-[4.6rem] bottom-0 right-[max(0px,calc(50%-44rem))] left-auto p-8 overflow-y-auto">
              <TableOfContents
                tableOfContents={tableOfContents}
                currentSection={currentSection}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};
