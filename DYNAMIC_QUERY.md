# Convex Cookbook: Dynamic Query Builders

## TL;DR

The file [`users.ts`](/convex/users.ts) has a pattern which you can copy to build queries dynamically. You can copy it into a .cursorcontext file to get Cursor to understand it, or otherwise add it to your workflow.

## What's a dynamic query?

Convex stores your data so you can query it in many ways.

Usually you know what you want, so you can write a query to get everything you need, like here you can get the 10 most recent messages with a given author:

```ts
const results = await ctx.db.query("messages")
  .withIndex("by_author", q=>q.eq("author", args.author))
  .order("desc")
  .take(10);
```

But sometimes you want to build the query dynamically, where parts of the query only apply in certain circumstances. e.g. You want a single query that can find messages by author, or by conversation, or with no filters at all. And once you've added the filters, you sometimes want to order ascending and sometimes descending.

Convex queries are plain TypeScript, so you want to build up a query like so:

```ts
let query = ctx.db.query("messages");
if (args.authorFilter !== undefined) {
  query = query.withIndex("by_author", q=>q.eq("author", args.authorFilter));
}
if (args.conversationFilter !== undefined) {
  query = query.withIndex("by_conversation", q=>q.eq("conversation", args.conversationId));
}
if (args.newestFirst) {
  query = query.order("desc");
}
const results = await query.take(10);
```

But if you try to write this code in TypeScript, it won't work! This article describes why and gives a recipe for fixing the problem.

## Compare to multiple queries

Perhaps the simplest solution is to write multiple queries, or to add branching internally.

Here's how you might do that:

```ts
let results;
if (args.authorFilter !== undefined) {
  results = await ctx.db.query("messages")
    .withIndex("by_author", q=>q.eq("author", args.authorFilter))
    .order(args.newestFirst ? "desc" : "asc")
    .take(10);
} else if (args.conversationFilter !== undefined) {
  results = await ctx.db.query("messages")
    .withIndex("by_conversation", q=>q.eq("conversation", args.conversationId))
    .order(args.newestFirst ? "desc" : "asc")
    .take(10);
} else {
  results = await ctx.db.query("messages")
    .order(args.newestFirst ? "desc" : "asc")
    .take(10);
}
```

This works, and makes it perfectly clear what's going on. However, there's a lot of code duplication here. e.g. if you rename the `newestFirst` argument, you have to change the query in three places. If you want more than ten results, you have to change all occurrences of `.take(10)`. And if you want to add a `.filter` to exclude hidden messages, you have to add it in three places.

Let's explore how we can make the query work without repeating ourselves.

## Compare to SQL

Let's look at the equivalent code you might use with a SQL database.

```ts
let sql = "SELECT * FROM messages";
if (args.authorFilter !== undefined) {
  sql += ` WHERE author = '${args.authorFilter}'`;
}
if (args.conversationFilter !== undefined) {
  sql += ` WHERE conversation = '${args.conversationFilter}'`;
}
sql += " ORDER BY _creationTime";
if (args.newestFirst) {
  sql += " DESC";
}
sql += " LIMIT 10";
const results = await executeSql(sql);
```

This code looks fine and works at runtime, but there are two subtle issues.

1. String interpolation creates a [SQL injection vulnerability](https://en.wikipedia.org/wiki/SQL_injection)
2. If both `authorFilter` and `conversationFilter` are provided, you end up with an invalid SQL expression `SELECT * FROM messages WHERE author = 'me' WHERE conversation = 'grouptext' ORDER BY _creationTime LIMIT 10`. There are two `WHERE` clauses. You could fix this by adding logic to turn the second `WHERE` into `AND`, or by doing `else if` instead of a plain `if`.

Convex's query builder prevents both of these issues.

1. Since you're building the query with a builder pattern instead of strings, Convex can escape user input and there's no possibility of an injection attack.
2. Convex's query builder ensures that all queries are valid. Every query uses a single index, so you can't call `.withIndex` twice. This is similar to the SQL constraint that each query only has a single `WHERE` keyword, but it's enforced in the TypeScript types.

## Solution 1: disable typechecks

Now we know why this Convex code won't pass TypeScript typechecking:

```ts
let query = ctx.db.query("messages");
if (args.authorFilter !== undefined) {
  query = query.withIndex("by_author", q=>q.eq("author", args.authorFilter));
}
if (args.conversationFilter !== undefined) {
  query = query.withIndex("by_conversation", q=>q.eq("conversation", args.conversationId));
}
```

if both `authorFilter` and `conversationFilter` exist, the query will have two `.withIndex` method calls, which is invalid. And now we can see our first workaround: disable typechecking.

```ts
// If query is any, you can do whatever you want with it.
let query: any = ctx.db.query("messages");
if (args.authorFilter !== undefined) {
  query = query.withIndex("by_author", q=>q.eq("author", args.authorFilter));
}
if (args.conversationFilter !== undefined) {
  query = query.withIndex("by_conversation", q=>q.eq("conversation", args.conversationId));
}
```

You can disable typechecking by `let query: any` or by using JavaScript instead of TypeScript. However, that's an unsatisfying answer. We *want* all of the guarantees Convex enforces, and we want intellisense to work as well.

## Solution 2: build query in stages

Our query should keep all of the necessary information in its type. On the initial table query -- `ctx.db.query("messages")` -- you can apply an index. But after you've applied an index, you can no longer apply another, so the query must change type. Similarly, you can't do `.order("desc").order("asc")` so applying an order also changes the query type.

Therefore we build the query in distinct stages:

1. Pick a table to query.
2. Pick an index and apply an index filter.
3. Pick an order.
4. Apply a post-filter, if any.
5. Get results.

```ts
// Stage 1: Pick the table to query.
const tableQuery = ctx.db.query("messages");
// Stage 2: Pick the index to use.
let indexedQuery: Query<T> = tableQuery;
if (args.authorFilter !== undefined) {
  indexedQuery = tableQuery.withIndex("by_author", q=>q.eq("author", args.authorFilter));
}
if (args.conversationFilter !== undefined) {
  indexedQuery = tableQuery.withIndex("by_conversation", q=>q.eq("conversation", args.conversationId));
}
// Stage 3: Apply ordering.
let orderedQuery: OrderedQuery<T> = indexedQuery;
if (args.newestFirst) {
  orderedQuery = indexedQuery.order("desc");
}
// Stage 4: Apply post-filters, if any. Filters don't change the query builder's type.
// You can also use the `filter` helper from `convex-helpers`.
if (args.excludeHidden) {
  orderedQuery = orderedQuery.filter(q => q.eq(q.field("hidden"), false));
}
// Stage 5: get results using `.first`, `.unique`, `.collect`, `.take`, or `.paginate`.
const results = await orderedQuery.take(10);
```

Now we've separated out the stages of building a dynamic query in Convex, while appeasing the TypeScript gods to ensure that the query is always valid. If you try this yourself, you'll find it *almost* works now! There are still two small issues:

1. Where does the type `T` come from?
2. What if you want to use a text search index `.withSearchIndex`?

## Type parameter inference

In the example above, you can see a type parameter `T` that wasn't defined anywhere:

```ts
let indexedQuery: Query<T> = tableQuery;
let orderedQuery: OrderedQuery<T> = indexedQuery;
```

You can solve this by giving an explicit type for `T`, like

```ts
import { DataModel } from "./_generated/dataModel";
let indexedQuery: Query<DataModel["messages"]> = tableQuery;
let orderedQuery: OrderedQuery<DataModel["messages"]> = indexedQuery;
```

or you can use helper functions to infer the type:

```ts
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

let indexedQuery = defaultIndex(tableQuery);
let orderedQuery = defaultOrder(indexedQuery);
```

## Text search indexes

[Text search indexes](https://docs.convex.dev/search/text-search) have both indexes *and* ordering. The ordering is by relevance, so the best text search matches appear first. When query building, text search encompasses both stages 2 (pick an index) and stage 3 (pick an order). Therefore when using a search index you would apply it to `tableQuery` and construct `orderedQuery`:

```ts
if (args.bodyFilter !== undefined) {
  orderedQuery = tableQuery.withSearchIndex("by_body", q=>q.search("body", args.bodyFilter));
}
```

## Put it all together

To see the pattern in action, check out the [users.ts](/convex/users.ts) file. This example includes filtering users by their unique token identifier or applying text search on the users' names. The example defines and uses the `defaultIndex` and `defaultOrder` helper functions for type inference, which you are free to copy.

Once you're using this pattern, you can construct dynamic queries at runtime, while maintaining intellisense and using TypeScript to ensure that the final query is valid.
