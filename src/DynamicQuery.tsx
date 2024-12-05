import { useMutation, useQuery } from "convex/react";
import { FormEvent, useState } from "react";
import { api } from "../convex/_generated/api";

export function DynamicQuery() {
  return (
    <>
      <h1>Dynamic Query</h1>
      <ListMessages />
      <CreateMessage />
    </>
  );
}

function ListMessages() {
  const [filterName, setFilterName] = useState("");
  const [filterConversation, setFilterConversation] = useState("");
  const [filterBody, setFilterBody] = useState("");
  const [excludeHidden, setExcludeHidden] = useState(false);
  const [filterDesc, setFilterDesc] = useState(false);
  
  const messages = useQuery(api.dynamicQuery.listMessages, {
    authorFilter: filterName === "" ? undefined : filterName,
    conversationFilter: filterConversation === "" ? undefined : filterConversation,
    bodyFilter: filterBody === "" ? undefined : filterBody,
    excludeHidden,
    newestFirst: filterDesc,
  }) || [];


  return (<>
      <div>
        Filter
        <input value={filterConversation} placeholder="Conversation" onChange={(event) => setFilterConversation(event.target.value)} />
        <input value={filterName} placeholder="Name" onChange={(event) => setFilterName(event.target.value)} />
        <input value={filterBody} placeholder="Body" onChange={(event) => setFilterBody(event.target.value)} />
        <p>
          only active
          <input type="checkbox" checked={excludeHidden} onChange={(event) => setExcludeHidden(event.target.checked)} />
          </p>
        <p>
          newest first
        <input type="checkbox" checked={filterDesc} onChange={(event) => setFilterDesc(event.target.checked)} />
        </p>
      </div>
      <ul>
        {messages.map((message) => (
          <li style={message.hidden ? {opacity: '50%'} : {}} key={message._id}>
            <span>{message.author}:</span>
            <span>{message.body}</span>
            <span>{message.conversation}</span>
            <span>{new Date(message._creationTime).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
  </>);
}

function CreateMessage() {
  const createMessage = useMutation(api.dynamicQuery.createMessage);

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    await createMessage({ author: userNameText, conversation: conversationText, hidden: isHidden, body: bodyText });
    setBodyText("");
    setIsHidden(false);
  }

  const [userNameText, setUserNameText] = useState("");
  const [conversationText, setConversationText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [isHidden, setIsHidden] = useState(false);


  return (
    <div>Create New Message
      <form onSubmit={handleCreateUser}>
        <input
          value={conversationText}
          onChange={(event) => setConversationText(event.target.value)}
          placeholder="Conversation"
        />
        <input
          value={userNameText}
          onChange={(event) => setUserNameText(event.target.value)}
          placeholder="Author"
        />
        <input value={bodyText} onChange={(event) => setBodyText(event.target.value)} placeholder="Body" />
        <p>active
        <input type="checkbox" checked={!isHidden} onChange={(event) => setIsHidden(!event.target.checked)} />
        </p>
        <input type="submit" value="Send" disabled={!userNameText || !conversationText || !bodyText} />
      </form>
      </div>
  );
}