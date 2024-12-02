import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { GenericTableInfo, OrderedQuery, Query, QueryInitializer } from "convex/server";

// Helper functions to coerce query types.
// Note there's no casting here, so this is totally safe.
// You could try to do it inline, e.g.
// `let indexedQuery: Query<T> = tableQuery;`
// The helper function lets us infer the type parameter T.
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
    if (args.name) {
      indexedQuery = tableQuery.withIndex("by_name", q => q.eq("name", args.name!));
    }
    if (args.token) {
      indexedQuery = tableQuery.withIndex("by_token", q => q.eq("tokenIdentifier", args.token!));
    }

    // Stage 3: Apply filters.
    if (args.onlyActive) {
      indexedQuery = indexedQuery.filter(q => q.eq(q.field("status"), "active"));
    }
    let orderedQuery = defaultOrder(indexedQuery);
    if (args.desc) {
      orderedQuery = indexedQuery.order("desc");
    }
    const results = await orderedQuery.take(10);
    return results;
  },
});
