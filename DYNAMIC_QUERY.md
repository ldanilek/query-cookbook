# Convex Cookbook: Dynamic Query Builders

## TL;DR

The file [dynamicQuery.ts](https://github.com/ldanilek/query-cookbook/blob/main/convex/dynamicQuery.ts) has a pattern which you can copy to build Convex queries dynamically.
You can copy it into a `.cursorrules` file to encourage Cursor to use it, or otherwise add it to your workflow.

## What's a dynamic query?

Convex stores your data so you can query it in many ways. This article will assume the following schema:

```ts
export default defineSchema({
  messages: defineTable({
    author: v.string(),
    conversation: v.string(),
    body: v.string(),
    hidden: v.boolean(),
  }).index("by_author", ["author"])
  .index("by_conversation", ["conversation"])
  .searchIndex("by_body", { searchField: "body" }),
})
```

Usually you know what you want, so you can write a query to get everything you need, like here you can get the 10 most recent messages with a given author:

```ts
const results = await ctx.db.query("messages")
  .withIndex("by_author", q=>q.eq("author", args.author))
  .order("desc")
  .take(10);
```

But sometimes you want to build the query dynamically, where parts of the query only apply in certain circumstances. e.g. You want a single query that can find messages by author, or by conversation, or with no filters at all. And once you've added the filters, you sometimes want to order ascending and sometimes descending.

Convex queries are plain TypeScript, so you want to build up a `query` variable
like so:

```ts
let query = ctx.db.query("messages");
if (args.authorFilter !== undefined) {
  query = query.withIndex("by_author", q=>q.eq("author", args.authorFilter));
}
if (args.conversationFilter !== undefined) {
  query = query.withIndex("by_conversation", q=>q.eq("conversation", args.conversationId));
}
if (args.bodyFilter !== undefined) {
  query = query.withSearchIndex("by_body", q=>q.search("body", args.bodyFilter));
}
if (args.newestFirst) {
  query = query.order("desc");
}
if (args.excludeHidden) {
  query = query.filter(q => q.eq(q.field("hidden"), false));
}
const results = await query.take(10);
```

This code works in JavaScript because there are no typechecks, but if you try to
write this code in TypeScript, it won't work! This article describes why and gives a recipe for fixing the problem.

## Why doesn't a single `query` variable work?

Convex queries are constrained by TypeScript to be valid, following simple rules:

- You can't use two indexes to execute a single query, so `query.withIndex(...).withIndex(...)` is invalid.
- A query can only have a single order, so `query.order("desc").order("asc")` is invalid.
- A text search index is both an index and an order (the order is by descending search relevance), so `.withSearchIndex(...)` is incompatible with `.withIndex(...)` and `.order(...)`.

In the above example, if `args.authorFilter` and `args.conversationFilter` are both provided,
the constructed query will have two `.withIndex` method calls.

A Convex query keeps all of the necessary information in its type. On the initial table query -- `ctx.db.query("messages")` -- you can apply an index. But after you've applied an index, you can no longer apply another, so the query must change type. Similarly, you can't do `.order("desc").order("asc")` so applying an order also changes the query type.

In TypeScript a variable can't change type conditionally, so you can't use a single `query` variable for all stages of building the query.

## Solution: build query in stages with multiple variables

The solution is to build the query with a new variable and type for each stage.

1. Pick a table to query.
2. Pick an index and apply an index filter.
3. Pick an order.

After these three stages, we have a complete query. There are still two things
we can do, but they don't change the query type:

- Apply a post-filter, if any.
- Get results.

```ts
// Stage 1: Pick the table to query.
const tableQuery: QueryInitializer<DataModel["messages"]> = ctx.db.query("messages");

// Stage 2: Pick the index to use.
let indexedQuery: Query<DataModel["messages"]> = tableQuery;
if (args.authorFilter !== undefined) {
  indexedQuery = tableQuery.withIndex("by_author", q=>q.eq("author", args.authorFilter));
}
if (args.conversationFilter !== undefined) {
  indexedQuery = tableQuery.withIndex("by_conversation", q=>q.eq("conversation", args.conversationId));
}

// Stage 3: Apply ordering.
let orderedQuery: OrderedQuery<DataModel["messages"]> = indexedQuery;
if (args.newestFirst) {
  orderedQuery = indexedQuery.order("desc");
}

// Stage 2 & 3: Apply text search index which includes both index and ordering.
if (args.bodyFilter !== undefined) {
  orderedQuery = tableQuery.withSearchIndex("by_body", q=>q.search("body", args.bodyFilter));
}

// Post-filter: Filters don't change the query builder's type.
// You can also use the `filter` helper from `convex-helpers`.
if (args.excludeHidden) {
  orderedQuery = orderedQuery.filter(q => q.eq(q.field("hidden"), false));
}

// Get results using `.first`, `.unique`, `.collect`, `.take`, or `.paginate`.
const results = await orderedQuery.take(10);
```

Now we've separated out the stages of building a dynamic query in Convex,
while appeasing the TypeScript gods to ensure that the query is always valid.

## Put it all together

The [dynamicQuery.ts](https://github.com/ldanilek/query-cookbook/blob/main/convex/dynamicQuery.ts)
file has the full example, along
with comparisons to untyped JavaScript and an equivalent SQL query builder.

When building a Convex app, you can usually use fixed queries whose structure
doesn't depend on runtime arguments. But sometimes you need to build a query
dynamically, and this article shows how to do so while maintaining typechecks.

Code helpers like Copilot and Cursor might not discover the pattern on their own,
so you can hint it to them by copying the example file into their context.
