export default function Navbar() {
//   const menu = [
//     {
//       name: "Inicio",
//     },
//     {
//       name: "Menu",
//     },
//     {
//       name: "Carrito",
//     },
//   ];
  return (
    <div className=" flex justify-center items-center">
      <div className="h-16 w-16">
        <img
          src="https://images.vexels.com/media/users/3/129606/isolated/preview/74fb78d3222ba12833ea9275c53a4935-logo-de-hamburguesa.png"
          alt=""
        />
      </div>

      {/* <div className=" w-full flex justify-center items-center">
        <div className=" border border-white  border-opacity-10 mt-2 flex p-2  text-white rounded-full gap-2">
          {menu.map((menu, i) => (
            <div className="hover:text-[#FF7A21] cursor-pointer " key={i}>
              {menu.name}
            </div>
          ))}
          <div className="rounded-full  flex hover:scale-105 h-6 w-6 duration-300 hover:text-[#FFBF19] cursor-pointer  justify-center items-center">
            <img src="https://images.vexels.com/media/users/3/129606/isolated/preview/74fb78d3222ba12833ea9275c53a4935-logo-de-hamburguesa.png" alt="" />
          </div>
        </div>
      </div> */}
    </div>
  );
}
