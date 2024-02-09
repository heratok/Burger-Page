
export default function Buscar() {
  return (
    <div className="relative h-10 w-full ml-2 mr-2 lg:w-[800px] mt-2">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <svg
        className="w-4 h-4 text-gray-500 dark:text-gray-400"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 20 20"
      >
        <path
          stroke="currentColor"
          d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
        />
      </svg>
    </div>
    <input
      type="search"
      className="block w-full border h-10   border-[#4E4F50] rounded-full bg-transparent outline-0 p-4 pl-10 text-sm"
      placeholder="Buscar..."
      autoComplete="off"
    ></input>
  </div>
  )
}
