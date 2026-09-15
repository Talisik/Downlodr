/**
 * A custom React Sub Page
 * This component acts as the not found page in case the navigation is pointed towards an invalid location
 *
 * @returns JSX.Element - The rendered component displaying not found page.
 */
const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-3xl font-bold mb-4">404</h1>
      <p className="text-xl">Page not found</p>
    </div>
  );
};

export default NotFound;
