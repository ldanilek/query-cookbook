import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { GenericTableInfo, OrderedQuery, Query, QueryInitializer } from "convex/server";

/**
 * Helper functions to coerce query types.
 * Note there's no casting here, so this is totally safe.
 * In other languages you could do it inline, e.g. in Rust,
 * `let indexedQuery: Query<_> = tableQuery;`
 * The helper function lets us infer the type parameter T.
 */
function defaultIndex<T extends GenericTableInfo>(
  query: QueryInitializer<T>
): Query<T> {
  return query;
}
function defaultOrder<T extends GenericTableInfo>(
  query: Query<T>
): OrderedQuery<T> {
  return query;
}

export const createMessage = mutation({
  args: {
    author: v.string(),
    conversation: v.string(),
    body: v.string(),
    hidden: v.boolean(),
  },
  handler: async (ctx, args) => {
    ctx.db.insert("messages", args);
  },
});

// This query is logically what you want, but it doesn't typecheck.
// NOT RECOMMENDED. DO NOT DO THIS.
// Code is provided so you can see what it would take to convert it to `listMessages` below.
export const listMessagesWithoutTypecheck = query({
  args: {
    authorFilter: v.optional(v.string()),
    conversationFilter: v.optional(v.string()),
    bodyFilter: v.optional(v.string()),
    excludeHidden: v.boolean(),
    newestFirst: v.boolean(),
  },
  handler: async (ctx, args) => {
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

// This query is equivalent to `listUsersWithoutTypecheck` above, but it typechecks.
// The type annotations ensure that only a single index and a single order apply.
// This pattern is recommended whenever you're building a query dynamically.
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
    // tableQuery has type QueryInitializer<T>
    const tableQuery = ctx.db.query("messages");

    // Stage 2: Pick the index to use.
    // indexedQuery has type Query<T>
    let indexedQuery = defaultIndex(tableQuery);
    if (args.authorFilter !== undefined) {
      // IMPORTANT: do tableQuery.withIndex, NOT indexedQuery.withIndex,
      // because you can only apply a single index.
      indexedQuery = tableQuery.withIndex("by_author", q => q.eq("author", args.authorFilter!));
    }
    if (args.conversationFilter !== undefined) {
      indexedQuery = tableQuery.withIndex("by_conversation", q => q.eq("conversation", args.conversationFilter!));
    }

    // Stage 3: Apply ordering or text search index.
    // orderedQuery has type OrderedQuery<T>
    let orderedQuery = defaultOrder(indexedQuery);
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

    // Stage 4: Apply filters.
    if (args.excludeHidden) {
      // You can also apply TypeScript filters, via `filter` from the convex-helpers library:
      // https://stack.convex.dev/complex-filters-in-convex
      orderedQuery = orderedQuery.filter(q => q.eq(q.field("hidden"), false));
    }

    // Stage 5: get results using `.first`, `.unique`, `.collect`, `.take`, or `.paginate`.
    const results = await orderedQuery.take(10);
    return results;
  },
});
