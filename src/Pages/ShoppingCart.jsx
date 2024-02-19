/* eslint-disable react/prop-types */
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ReplyIcon from "@mui/icons-material/Reply";
import NoBuy from "../Components/NoBuy";
// import { useState } from "react";

// eslint-disable-next-line react/prop-types
function ShoppingCart({ cerrar, cerrarCarrito, abrirForm, list, deleteCart }) {
  // const [nameDel, setNameDel] = useState("");
  const volver = () => {
    cerrar();
    cerrarCarrito();
  };
  const calcularTotal = list.reduce(
    (total, burger) => total + burger.totalapagar,
    0
  );

  const deleteCar = (name) => {
    const filter = list.filter((burger) => burger.name !== name);
    deleteCart(filter);
  };

  const open = () => {
    cerrarCarrito();
    abrirForm();
  };
  console.log("len", list.length);
  return (
    <div className=" h-screen p-4 ">
      {list.length === 0 ? (
        <NoBuy volver={volver}></NoBuy>
      ) : (
        <div className="">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold">My Cart</div>
            <div className="text-xl font-bold text-[#FF7A21]">
              ${calcularTotal.toLocaleString()}
            </div>
          </div>
          <div className="  ">
            <div className=" items-center">
              {list.map((burgerCompra, i) => (
                <div
                  className="flex pl-4 w-full bg-[#151517] rounded-lg p-4 mt-2"
                  key={i}
                >
                  <div className="flex justify-center items-center">
                    <img
                      src={burgerCompra.src}
                      alt="Instant Camera WHITE"
                      className=" lg:w-28 lg:h-28  w-36"
                    ></img>
                  </div>
                  <div className="w-full ml-2">
                    <div className="flex justify-between text-lg font-bold text-white">
                      <div className="text-[#FF7A21] font-bold">
                        {burgerCompra.name}
                      </div>
                      <div
                        className="cursor-pointer hover:scale-105 duration-75"
                        onClick={() => deleteCar(burgerCompra.name)}
                      >
                        <DeleteForeverIcon style={{ color: "FF7A21" }} />
                      </div>{" "}
                    </div>
                    <div className="text-white w-full">
                      {burgerCompra.cantidad} x {burgerCompra.name}{" "}
                      {burgerCompra.observacion === ""
                        ? ""
                        : `(Observacion:
                      ${burgerCompra.observacion}) `}
                      {burgerCompra.adicion.length > 0
                        ? `  (
                      ${burgerCompra.adicion.map(
                        (ad) => `${ad.cantidad} x ${ad.name} `
                      )}
                      )`
                        : ""}
                    </div>
                    <div className="mt-2 text-lg font-bold text-[#FF7A21] ">
                      $ {burgerCompra.totalapagar.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className=" lg:flex gap-4   justify-between  ">
            <button
              type="submit"
              className="text-white mt-5 flex justify-center items-center gap-1 bg-[#FF7A21] hover:bg-orange-400   font-medium rounded-lg text-sm w-full sm:w-full px-5 py-2.5  lg:w-full text-center "
              onClick={open}
            >
              Confirmar Orden
            </button>
            <button
              type="submit"
              className="text-white mt-5 flex justify-center items-center gap-1 bg-[#FF7A21] hover:bg-orange-400   font-medium rounded-lg text-sm w-full  lg:full sm:w-full px-5 py-2.5 text-center "
              onClick={volver}
            >
              <ReplyIcon />
              Volver a la Tienda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShoppingCart;
