import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  return (
    <main>
      <h1>Convex Query Cookbook</h1>
      <ListUsers />
      <CreateUser />
    </main>
  );
}

function ListUsers() {
  const [filterName, setFilterName] = useState("");
  const [filterToken, setFilterToken] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const [filterDesc, setFilterDesc] = useState(false);
  
  const users = useQuery(api.users.listUsers, {
    name: filterName === "" ? undefined : filterName,
    token: filterToken === "" ? undefined : filterToken,
    onlyActive: filterActive,
    desc: filterDesc,
  }) || [];


  return (<>
      <div>
        Filter
        <input value={filterName} placeholder="Name" onChange={(event) => setFilterName(event.target.value)} />
        <input value={filterToken} placeholder="Token" onChange={(event) => setFilterToken(event.target.value)} />
        <p>
          only active
          <input type="checkbox" checked={filterActive} onChange={(event) => setFilterActive(event.target.checked)} />
          </p>
        <p>
          newest first
        <input type="checkbox" checked={filterDesc} onChange={(event) => setFilterDesc(event.target.checked)} />
        </p>
      </div>
      <ul>
        {users.map((user) => (
          <li key={user._id}>
            <span>{user.name}:</span>
            <span>{user.tokenIdentifier}</span>
            <span>{user.status}</span>
            <span>{new Date(user._creationTime).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
  </>);
}

function CreateUser() {
  const createUser = useMutation(api.users.createUser);

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    await createUser({ name: userNameText, token: tokenText, status: "active" });
    setUserNameText("");
    setTokenText("");
    setStatusText("active");
  }

  const [userNameText, setUserNameText] = useState("");
  const [tokenText, setTokenText] = useState("");
  const [statusText, setStatusText] = useState("active");


  return (
    <div>Create New User
      <form onSubmit={handleCreateUser}>
        <input
          value={userNameText}
          onChange={(event) => setUserNameText(event.target.value)}
          placeholder="User Name"
        />
        <input
          value={tokenText}
          onChange={(event) => setTokenText(event.target.value)}
          placeholder="Token"
        />
        <p>active
        <input type="checkbox" checked={statusText === "active"} onChange={(event) => setStatusText(event.target.checked ? "active" : "inactive")} />
        </p>
        <input type="submit" value="Send" disabled={!userNameText || !tokenText} />
      </form>
      </div>
  );
}