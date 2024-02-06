import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";
// eslint-disable-next-line react/prop-types
export default function Additions({ cerrar }) {
  const [cantidad, setCantidad] = useState(0);
  const aumentar = () => {
    setCantidad(cantidad + 1);
  };
  const disminuir = () => {
    if (cantidad > 0) {
      setCantidad(cantidad - 1);
    }
  };
  return (
    <div className=" h-screen w-screen">
      <div className="w-full flex justify-end">
        <div
          className="rounded-full p-2 h-10 w-10 hover:bg-opacity-10 bg-blue-50 bg-opacity-20"
          onClick={cerrar}
        >
          <CloseIcon></CloseIcon>
        </div>
      </div>

      <div className="flex justify-center">
        <img
          className="w-44"
          src="https://static.vecteezy.com/system/resources/previews/021/952/463/original/tasty-hamburger-on-transparent-background-png.png"
          alt=""
        />
        <div className="">
          <span className="font-bold">la pipona</span>
          <p className="w-96 text-white text-opacity-50">
            Lorem ipsum dolor sit amet consectetur, adipisicing elit. Maiores
            sint excepturi et exercitationem ex molestiae fugit, aut consequatur
            incidunt, voluptatum labore voluptas perspiciatis! Rerum omnis
            facilis voluptates a, repellendus ex.
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-center items-center">
        <div className="flex justify-center">
          <div className="flex w-96 justify-between">
            <span>Adiciones</span>
            <span className="bg-[#FFBF19] rounded-lg p-1">Opcional</span>
          </div>
        </div>
        <div className="mt-2 bg-white bg-opacity-10 p-2  gap-2 w-96 rounded-lg flex ">
          <div className="w-full flex gap-2">
            {" "}
            <div className="bg-white bg-opacity-15 p-1 w-14 h-14 flex justify-center items-center rounded-full">
              <img
                className=" rounded-full"
                src="https://img.freepik.com/fotos-premium/contenedor-amarillo-papas-fritas-cara-cara-sonriente_913665-3058.jpg"
                alt=""
              />
            </div>
            <span>
              Papas
              <br />
              $5.00
            </span>
          </div>
          <div className="flex gap-2 justify-center items-center">
            <div
              className="p-2 h-7 w-7 flex justify-center items-center rounded-full cursor-pointer bg-[#FFBF19] "
              onClick={disminuir}
            >
              -
            </div>
            <div className="">{cantidad}</div>
            <div
              className="p-2 h-7 w-7 cursor-pointer flex justify-center items-center  rounded-full bg-[#FFBF19] "
              onClick={aumentar}
            >
              +
            </div>
          </div>
        </div>
        <div className="mt-2 bg-white bg-opacity-10 p-2  gap-2 w-96 rounded-lg flex ">
          <div className="w-full flex gap-2">
            {" "}
            <div className="bg-white bg-opacity-15 p-1 w-14 h-14 flex justify-center items-center rounded-full">
              <img
                className=" rounded-full"
                src="https://img.freepik.com/fotos-premium/contenedor-amarillo-papas-fritas-cara-cara-sonriente_913665-3058.jpg"
                alt=""
              />
            </div>
            <span>
              Papas
              <br />
              $5.00
            </span>
          </div>
          <div className="flex gap-2 justify-center items-center">
            <div
              className="p-2 h-7 w-7 flex justify-center items-center rounded-full cursor-pointer bg-[#FFBF19] "
              onClick={disminuir}
            >
              -
            </div>
            <div className="">{cantidad}</div>
            <div
              className="p-2 h-7 w-7 cursor-pointer flex justify-center items-center  rounded-full bg-[#FFBF19] "
              onClick={aumentar}
            >
              +
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-4">
          <div className="flex w-96 justify-between">
            <span>Observaciones</span>
            <span className="bg-[#FFBF19] rounded-lg p-1">Opcional</span>
          </div>
        </div>
      </div>

      <form className="max-w-sm mx-auto mt-4">
        <textarea
          id="message"
          rows="4"
          className="block p-2.5 w-full text-sm text-gray-900 bg-[#181A1B] rounded-lg border border-white focus:ring-blue-500 focus:border-blue-500  dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Observaciones"
        ></textarea>
      </form>
      <div className="flex justify-center">
        <div className="flex justify-between w-96 mt-4">
          <div className="flex  justify-center items-center bg-white bg-opacity-5 rounded-full p-2 gap-7">
            <div
              className="p-2 h-7 w-7 flex justify-center items-center rounded-full cursor-pointer bg-red-500 "
              onClick={disminuir}
            >
              -
            </div>
            <div className="">{cantidad}</div>
            <div
              className="p-2 h-7 w-7 cursor-pointer flex justify-center items-center  rounded-full bg-red-500 "
              onClick={aumentar}
            >
              +
            </div>
          </div>
          <button className="p-2 bg-red-500 rounded-full">
            Agregar $30.000{" "}
          </button>
        </div>
      </div>
    </div>
  );
}
