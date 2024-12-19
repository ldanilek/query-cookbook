import { v } from "convex/values";
import { query } from "./_generated/server";
import { OrderedQuery, Query, QueryInitializer } from "convex/server";
import { DataModel } from "./_generated/dataModel";

// Example of a dynamic query, where the query does different things depending on the arguments.
// In general it returns 10 messages, but based on the arguments it will filter by the index on author, conversation, or body.
// It also supports ordering in either direction (newest first or oldest first), and conditionally excluding hidden messages.
// This pattern is recommended whenever you're building a query dynamically.
// The key point of the pattern is there are multiple stages, and each stage changes the type of the query, so there are three variables to represent the query at each stage.
export const listMessages = query({
  args: {
    authorFilter: v.optional(v.string()),
    conversationFilter: v.optional(v.string()),
    bodyFilter: v.optional(v.string()),
    excludeHidden: v.boolean(),
    newestFirst: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Stage 1: Pick the table to query.
    // tableQuery has type QueryInitializer which means it has a table but no
    // index or order applied.
    const tableQuery: QueryInitializer<DataModel["messages"]> = ctx.db.query("messages");

    // Stage 2: Pick the index to use.
    // The new variable with type coercion is necessary so `indexedQuery` can be
    // any Query with an index applied.
    let indexedQuery: Query<DataModel["messages"]> = tableQuery;
    if (args.authorFilter !== undefined) {
      // IMPORTANT: do tableQuery.withIndex, NOT indexedQuery.withIndex,
      // because you can only apply a single index.
      indexedQuery = tableQuery.withIndex("by_author", q => q.eq("author", args.authorFilter!));
    }
    if (args.conversationFilter !== undefined) {
      indexedQuery = tableQuery.withIndex("by_conversation", q => q.eq("conversation", args.conversationFilter!));
    }

    // Stage 3: Apply ordering or text search index.
    // The new variable with type coercion is necessary so `orderedQuery` can be
    // any OrderedQuery with an index and order applied.
    let orderedQuery: OrderedQuery<DataModel["messages"]> = indexedQuery;
    if (args.newestFirst) {
      // IMPORTANT: do indexedQuery.order, NOT orderedQuery.order,
      // because you can only apply a single order.
      orderedQuery = indexedQuery.order("desc");
    }
    if (args.bodyFilter) {
      // IMPORTANT: do tableQuery.withSearchIndex, NOT orderedQuery.withSearchIndex or indexedQuery.withSearchIndex,
      // because a text search index is both an index and an order (the order is by search relevance).
      orderedQuery = tableQuery.withSearchIndex("by_body", q => q.search("body", args.bodyFilter!));
    }

    // Post-filter: Apply filters.
    if (args.excludeHidden) {
      orderedQuery = orderedQuery.filter(q => q.eq(q.field("hidden"), false));
      // You can also apply TypeScript filters, via `filter` from the convex-helpers library:
      // https://stack.convex.dev/complex-filters-in-convex
    }

    // Stage 5: get results using `.first`, `.unique`, `.collect`, `.take`, or `.paginate`.
    const results = await orderedQuery.take(10);
    return results;
  },
});

// This query is logically what you want, but it doesn't typecheck.
// NOT RECOMMENDED. DO NOT DO THIS.
// Code is provided so you can see what it would take to convert it to `listMessages` above.
export const listMessagesWithoutTypecheck = query({
  args: {
    authorFilter: v.optional(v.string()),
    conversationFilter: v.optional(v.string()),
    bodyFilter: v.optional(v.string()),
    excludeHidden: v.boolean(),
    newestFirst: v.boolean(),
  },
  handler: async (ctx, args) => {
    // NOTE the `any` means that no types are checked.
    // This pattern works for (untyped) JavaScript, but in TypeScript you should
    // use the pattern in `listMessages` below.
    let query: any = ctx.db.query("messages");
    if (args.authorFilter !== undefined) {
      query = query.withIndex("by_author", (q: any) => q.eq("author", args.authorFilter!));
    }
    if (args.conversationFilter !== undefined) {
      query = query.withIndex("by_conversation", (q: any) => q.eq("conversation", args.conversationFilter!));
    }
    if (args.newestFirst) {
      query = query.order("desc");
    }
    if (args.bodyFilter) {
      query = query.withSearchIndex("by_body", (q: any) => q.search("body", args.bodyFilter!));
    }
    if (args.excludeHidden) {
      query = query.filter((q: any) => q.eq(q.field("hidden"), false));
    }
    const results = await query.take(10);
    return results;
  },
});

// As another example of equivalent queries,
// here's a SQL query that does the same thing as `listMessages` above.
// NOTE Convex does not support SQL queries, so this is just for comparison.
function sqlExample({
  authorFilter,
  conversationFilter,
  bodyFilter,
  excludeHidden,
  newestFirst,
}: {
  authorFilter?: string;
  conversationFilter?: string;
  bodyFilter?: string;
  excludeHidden: boolean;
  newestFirst: boolean;
}) {
  let sql = `SELECT * FROM messages`;
  const clauses = [];
  if (authorFilter !== undefined) {
    // Note the SQL injection vulnerability, which Convex doesn't have because it's not SQL.
    clauses.push(`author = '${authorFilter}'`);
  }
  if (conversationFilter !== undefined) {
    clauses.push(`conversation = '${conversationFilter}'`);
  }
  if (bodyFilter !== undefined) {
    clauses.push(`body LIKE '%${bodyFilter}%'`);
  }
  if (excludeHidden) {
    clauses.push(`hidden = false`);
  }
  if (clauses.length > 0) {
    sql += " WHERE " + clauses.join(" AND ");
  }
  sql += " ORDER BY _creationTime";
  if (newestFirst) {
    sql += " DESC";
  }
  sql += ` LIMIT 10`;
  return sql;
}
