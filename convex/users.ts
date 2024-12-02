import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { GenericTableInfo, OrderedQuery, Query, QueryInitializer } from "convex/server";
import { DataModel } from "./_generated/dataModel";

/**
 * Helper functions to coerce query types.
 * Note there's no casting here, so this is totally safe.
 * In other languages you could do it inline, e.g.
 * `let indexedQuery: Query<T> = tableQuery;`
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

export const createUser = mutation({
  args: {
    name: v.string(),
    token: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    ctx.db.insert("users", {
      name: args.name,
      tokenIdentifier: args.token,
      status: args.status,
    });
  },
});

export const listUsers = query({
  args: {
    name: v.optional(v.string()),
    token: v.optional(v.string()),
    onlyActive: v.boolean(),
    desc: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Stage 1: Pick the table to query.
    // tableQuery has type QueryInitializer<T>
    const tableQuery = ctx.db.query("users");

    // Stage 2: Pick the index to use.
    // indexedQuery has type Query<T>
    let indexedQuery = defaultIndex(tableQuery);
    if (args.token) {
      // IMPORTANT: do tableQuery.withIndex, NOT indexedQuery.withIndex,
      // because you can only apply a single index.
      indexedQuery = tableQuery.withIndex("by_token", q => q.eq("tokenIdentifier", args.token!));
    }

    // Stage 3: Apply ordering or text search index.
    // orderedQuery has type OrderedQuery<T>
    let orderedQuery = defaultOrder(indexedQuery);
    if (args.desc) {
      // IMPORTANT: do indexedQuery.order, NOT orderedQuery.order,
      // because you can only apply a single order.
      orderedQuery = indexedQuery.order("desc");
    }
    if (args.name) {
      // IMPORTANT: do tableQuery.withSearchIndex, NOT orderedQuery.withSearchIndex or indexedQuery.withSearchIndex,
      // because a text search index is both an index and an order (the order is by search relevance).
      orderedQuery = tableQuery.withSearchIndex("by_name", q => q.search("name", args.name!));
    }

    // Stage 4: Apply filters.
    if (args.onlyActive) {
      // NOTE: you can apply filters on indexedQuery or orderedQuery.
      // You can also apply TypeScript filters on the results:
      // https://stack.convex.dev/complex-filters-in-convex
      orderedQuery = orderedQuery.filter(q => q.eq(q.field("status"), "active"));
    }

    // Stage 5: get results using `.first`, `.unique`, `.collect`, `.take`, or `.paginate`.
    const results = await orderedQuery.take(10);
    return results;
  },
});
