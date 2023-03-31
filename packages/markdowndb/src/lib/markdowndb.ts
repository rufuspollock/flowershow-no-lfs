import knex, { Knex } from "knex";
import * as fs from "fs";
import * as crypto from "crypto";
import matter from "gray-matter";
import { DatabaseFile, DatabaseQuery } from "./types";

export const indexFolder = async (
  dbPath: string,
  folderPath = "content",
  ignorePatterns: RegExp[] = []
) => {
  const dbConfig = {
    client: "sqlite3",
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
  };

  const db = knex(dbConfig);

  await createFilesTable(db);
  await createTagsTable(db);
  await createFileTagsTable(db);

  //  Temporary, we don't want to handle updates now
  //  so database is refreshed every time the folder
  //  is indexed
  await db("file_tags").del();
  await db("tags").del();
  await db("files").del();

  const pathsToFiles = walkFolder(folderPath);

  const filesToInsert = [];
  const tagsToInsert = [];
  const fileTagsToInsert = [];

  for (const pathToFile of pathsToFiles) {
    let file;

    try {
      file = createDatabaseFile(pathToFile, folderPath);
    } catch (e) {
      console.log(
        `MarkdownDB Error: Failed to parse '${pathToFile}'. Skipping...`
      );
      console.log(e);
      file = null;
    }

    if (file) {
      let isIgnoredByPattern = false;
      for (const pattern of ignorePatterns) {
        if (pattern.test(file._url_path)) {
          isIgnoredByPattern = true;
        }
      }

      if (!isIgnoredByPattern) {
        //  There are probably better ways of doing this...
        if (["md", "mdx"].includes(file.filetype)) {
          const tags = file.metadata?.tags || [];

          for (const tag of tags) {
            if (!tagsToInsert.find((item) => item.name === tag)) {
              tagsToInsert.push({ name: tag });
            }
            fileTagsToInsert.push({ tag, file: file._id });
          }

          //  Sqlite3 does not support JSON fields
          file.metadata = JSON.stringify(file.metadata);
        }

        filesToInsert.push(file);
      }
    }
  }

  await db.batchInsert("files", filesToInsert);
  await db.batchInsert("tags", tagsToInsert);
  await db.batchInsert("file_tags", fileTagsToInsert);

  db.destroy();
};

//  Get files inside a folder, return an array of file paths
const walkFolder = (dir: fs.PathLike) => {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    if (!(dir as string).endsWith("/")) {
      dir += "/";
    }

    const fullPath = dir + item;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(walkFolder(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const createFilesTable = async (db: Knex) => {
  const tableExists = await db.schema.hasTable("files");

  if (!tableExists) {
    await db.schema.createTable("files", (table) => {
      table.string("_id").primary();
      table.string("_path").unique().notNullable(); //  Can be used to read a file
      table.string("_url_path").unique(); //  Can be used to query by folder
      table.string("metadata");
      table.string("filetype").notNullable();
      // table.enu("fileclass", ["text", "image", "data"]).notNullable();
      table.string("type"); // type field in frontmatter if it exists
    });
  }
};

const createTagsTable = async (db: Knex) => {
  const tableExists = await db.schema.hasTable("tags");

  if (!tableExists) {
    await db.schema.createTable("tags", (table) => {
      // table.string("_id"); We probably don't need an id
      table.string("name").primary();
    });
  }
};

const createFileTagsTable = async (db: Knex) => {
  const tableExists = await db.schema.hasTable("file_tags");

  if (!tableExists) {
    await db.schema.createTable("file_tags", (table) => {
      table.string("tag").notNullable();
      table.string("file").notNullable();

      table.foreign("tag").references("tags.name").onDelete("CASCADE");
      table.foreign("file").references("files._id").onDelete("CASCADE");
      //  ... maybe onUpdate(CASCADE) as well?
    });
  }
};

const createDatabaseFile: (path: string, folderPath: string) => DatabaseFile = (
  path: string,
  folderPath: string
) => {
  const filetype = path.split(".").at(-1);

  const encodedPath = Buffer.from(path, "utf-8").toString();
  const id = crypto.createHash("sha1").update(encodedPath).digest("hex");

  let metadata = null;
  let type = null;

  //  If it's not a md/mdx file, _url_path is just the relative path
  const pathRelativeToFolder = path.slice(folderPath.length + 1);
  let _url_path = pathRelativeToFolder;

  if (["md", "mdx"].includes(filetype)) {
    const source = fs.readFileSync(path, { encoding: "utf8", flag: "r" });
    const { data } = matter(source);
    metadata = data || null;
    type = data.type || null;

    const segments = pathRelativeToFolder.split("/");
    const filename = segments.at(-1).split(".")[0];

    const pathToFileFolder = segments.slice(0, -1).join("/");

    if (filename != "index") {
      if (pathToFileFolder) {
        _url_path = `${pathToFileFolder}/${filename}`;
      } else {
        //  The file is in the root folder
        _url_path = filename;
      }
    } else {
      _url_path = pathToFileFolder;
    }
  }

  return {
    _id: id,
    _path: path,
    _url_path, //  Should exist only for MD/MDX files
    filetype,
    metadata,
    type,
  };
};

class MarkdownDB {
  db: Knex;

  constructor(db: Knex) {
    this.db = db;
  }

  async getTags() {
    return this.db("tags")
      .select()
      .then((tags) => tags.map((tag) => tag.name));
  }

  async query<T = DatabaseFile>(
    query?: DatabaseQuery
  ): Promise<DatabaseFile<T>[]> {
    const files = this.db
      .select("files.*", this.db.raw("GROUP_CONCAT(tag) as tags")) //  Very hackish way to return tags without duplicating rows
      .from<DatabaseFile>("files")
      .leftJoin("file_tags AS ft", "ft.file", "_id")
      .where((builder) => {
        if (query) {
          let folder = query.folder;
          if (folder) {
            if (folder.at(-1) === "/") {
              folder = query.folder.slice(0, -1);
            }

            builder.whereLike("_url_path", `${folder}/%`);
          }

          const tags = query.tags;
          if (tags) {
            builder.whereIn("tag", tags);
          }

          const filetypes = query.filetypes;
          if (filetypes) {
            builder.whereIn("filetype", filetypes);
          }

          const urlPath = query.urlPath;
          if (urlPath != undefined) {
            builder.where("_url_path", urlPath);
          }
        }
      })
      .groupBy("_id");

    return files.then((files) => {
      return files.map((file) => {
        if (["mdx", "md"].includes(file.filetype)) {
          file.tags = file.tags?.split(",") || [];
          file.metadata = JSON.parse(file.metadata);

          return file;
        } else {
          delete file.tags;
        }
        return file;
      });
    });
  }

  _destroyDb() {
    this.db.destroy();
  }
}

//  MarkdownDB Factory
export const Database = (dbPath: string): MarkdownDB => {
  const dbConfig = {
    client: "sqlite3",
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
  };

  const db = knex(dbConfig);

  return new MarkdownDB(db);
};
