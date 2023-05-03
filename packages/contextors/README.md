contextors
==========

A library for creating "contextors", which efficiently select and combine values
from React contexts.

 - **Contextors combine the values of multiple contexts** to compute a single value
 which is updated when any of its input values change.
 - **Contextors are efficient and stable.** A contextor will always produce the same
 output given the same input values.
 - **Contextors are composable.** They can be used as inputs to other contextors.
 - **Contextors can be parameterized.** A contextor's combining function can accept an
 extra parameter alongside the context-dependent input values.

## Basic Usage

    # Create some Contexts
    const UserContext  = contexto.createContext({
      firstName: "Henry",
      lastName:  "Lemming",
      teamIds:   [1, 3],
    });
    const TeamsContext = contexto.createContext([
      { id: 1, name: "Builders" },
      { id: 2, name: "Climbers" },
      { id: 3, name: "Floaters" },
      { id: 4, name: "Miners"   },
    ]);

    # Create a Contextor that takes a TeamsContext value,
    # and returns a value derived from that
    const TeamsLookup = createContextor(
      [TeamsContext],
      (teams) => Object.fromEntries(teams.map(team => [team.id, team]))
    );

    # Create a Contextor that takes values from UserContext and a different Contextor,
    # and returns a value derived from those
    const UserSummary = createContextor(
      [UserContext, TeamsLookup],
      (user, teamsById) => ({
        name:      `${user.firstName} ${user.lastName}`,
        teamNames: user.teamIds.map(id => teamsById[id].name).join(", ")
      })
    );

    # The useContextor hook subscribes to the local values of all contexts
    # required to evaluate the given Contextor
    function UserNameComponent() {
      const { name, teamNames } = useContextor(UserSummary);
      return <div><b>{name}</b> ({ teamNames || "no teams" })</div>;
    }

## Computing data with contextors

Contextors are constructed using `createContextor`. They require an array of inputs,
each of which is a Contextor or a `Contexto.Context` object, and a combining function,
which returns data based on the current values associated with those inputs.

A very simple contextor might depend on the value of a single context:

    const BookCount =
      createContextor(
        [BooksContext],           // A context defined somewhere
        (books) => books.length   // Operates on the local value of the context
      );

More complex contextors can depend on the values of multiple contexts:

    const CurrentBook =
      createContextor(
        [CurrentBookIdContext, BooksContext],
        (currentBookId, books) =>
          books.filter(book => book.id === currentBookId)[0]
      );

Contextors can also depend on the values of other contextors:

    const BookSummary =
      createContextor(
        [CurrentBook, AuthorsContext],
        (book, authors) => ({
          title:  book.title,
          author: authors.filter(book.authorId === author.id)
        })
      );

## Parameterized contextors

A contextor can accept an extra argument in its combining function.

    function BlogProvider({ children }) {
      const { data: posts, isLoading } = useQuery("posts", () =>
        fetch("https://jsonplaceholder.typicode.com/posts").then((res) => res.json())
      );

      if (isLoading)
        return "Loading ...";
      else
        return <BlogContext.Provider value={posts} children={children} />;
    }

    function filterPosts(posts: Post[], filterString: string) {
      return posts.filter((post) => post.title.includes(filterString));
    }

    const BlogFilter = createContextor(
      [BlogContext],
      ({ posts }, searchTerm) => ({
        posts: posts.filter(({ title }) => title.includes(searchTerm))
      })
    );

    const BlogPostList = () => {
      const [searchTerm, setSearchTerm] = useState("");
      const filteredPosts = useContextor(BlogFilter, searchTerm);

      return (
        <div>
          <input onChange={ e => setSearchTerm(e.target.value) }>
          <ul>
            {filteredPosts.map((post) => (
              <li key={post.id}>{post.title}</li>
            ))}
          </ul>
        </div>
      );
    };

## Advanced Usage

Contextors can be created 

## Caching

memoized vs "omni-cache"

## Contextors vs selectors