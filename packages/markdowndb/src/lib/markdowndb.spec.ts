import knex from "knex";
import * as markdowndb from "./markdowndb";
import * as fs from "fs";

/**
 * @jest-environment node
 */
describe("MarkdownDB lib", () => {
  it("builds a new MarkdownDB", async () => {
    const pathToFixturesFolder = "packages/markdowndb/__mocks__/content";
    const dbConfig = {
      client: "sqlite3",
      connection: {
        filename: "markdown.db",
      },
    };

    const db = knex(dbConfig);

    //  Index folder
    await markdowndb.indexFolder("markdown.db", pathToFixturesFolder);

    //  Ensure there is a "files" table
    expect(await db.schema.hasTable("files")).toBe(true);

    //  Ensure there is a "tags" table
    expect(await db.schema.hasTable("tags")).toBe(true);

    //  Ensure there is a "file_tags" table
    expect(await db.schema.hasTable("file_tags")).toBe(true);

    const myMdDb = markdowndb.Database("markdown.db");

    //  Check if all files were indexed
    const allFiles = walk(pathToFixturesFolder);
    const allFilesCount = allFiles.length;

    const allIndexedFiles = await myMdDb.query();
    expect(allIndexedFiles.length).toBe(allFilesCount);

    //  Check if querying by folder is working
    const blogFiles = allFiles.filter((p) =>
      p.startsWith(`${pathToFixturesFolder}/blog/`)
    );
    const blogFilesCount = blogFiles.length;

    const indexedBlogFiles = await myMdDb.query({
      folder: "blog",
      filetypes: ["md", "mdx"],
    });

    expect(indexedBlogFiles.length).toBe(blogFilesCount);

    //  Check if querying by tags is working
    const economyFiles = await myMdDb.query({ tags: ["economy"] });
    const economyFilesPaths = economyFiles.map((f) => f._path);

    const expectedPaths = [
      `${pathToFixturesFolder}/blog/blog3.mdx`,
      `${pathToFixturesFolder}/blog/blog2.mdx`,
    ];

    expect(economyFilesPaths).toHaveLength(expectedPaths.length);
    economyFilesPaths.forEach((p) => {
      expect(expectedPaths).toContain(p);
    });

    //  Check if querying by filetypes is working
    const pngFiles = await myMdDb.query({ filetypes: ["png"] });
    expect(
      pngFiles
        .map((f) => f.filetype)
        //  Filter out duplicates
        .filter((v, i, s) => {
          return s.indexOf(v) === i;
        })
    ).toEqual(["png"]);

    db.destroy();
    myMdDb._destroyDb();
  });
});

const walk = (dir: fs.PathLike) => {
  let files: string[] = [];
  for (const item of fs.readdirSync(dir)) {
    if (!(dir as string).endsWith("/")) {
      dir += "/";
    }

    const fullPath = dir + item;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(walk(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};
