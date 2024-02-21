/* eslint-disable react/prop-types */
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";
// eslint-disable-next-line react/prop-types
export default function Additions({ cerrar, hamburger, agregarList }) {
  const [cantidad, setCantidad] = useState(1);
  const [observaciones, setObservaciones] = useState("");
  const adiitions = [
    {
      name: "papas fritas",
      pirce: 5000,
      cantidad: 0,
    },
    {
      name: "Cebolla Caramelizada",
      pirce: 1500,
      cantidad: 0,
    },
    {
      name: "Extra queso",
      pirce: 2700,
      cantidad: 0,
    },
    {
      name: "Tocineta",
      pirce: 2500,
      cantidad: 0,
    },
  ];
  const [adiciones, setAdiciones] = useState(adiitions);
  const calcularTotal = () => {
    let totalAdiciones = adiciones.reduce(
      (total, ad) => total + ad.cantidad * ad.pirce,
      0
    );
    return hamburger.price * cantidad + totalAdiciones;
  };
  const agregar = () => {
    agregarList({
      adicion: adiciones.filter((adi) => adi.cantidad > 0),
      name: hamburger.name,
      src: hamburger.src,
      totalapagar: calcularTotal(),
      cantidad: cantidad,
      observacion: observaciones,
    });
    cerrar();
  };
  const aumentarBurger = () => {
    setCantidad(cantidad + 1);
  };

  const disminuirBurger = () => {
    if (cantidad > 1) {
      setCantidad(cantidad - 1);
    }
  };
  const modificarCantidadAdicion = (index, operacion) => {
    const nuevasAdiciones = [...adiciones];
    if (operacion === "incrementar") {
      nuevasAdiciones[index].cantidad += 1;
    } else if (
      operacion === "decrementar" &&
      nuevasAdiciones[index].cantidad > 0
    ) {
      nuevasAdiciones[index].cantidad -= 1;
    }
    setAdiciones(nuevasAdiciones);
  };
  //capturando
  console.log({
    adicion: adiciones.filter((adi) => adi.cantidad > 0),
    name: hamburger.name,
    totalapagar: calcularTotal(),
    observacion: observaciones,
  });
  console.log(adiciones);
  return (
    <div className="w-screen h-screen ">
      <div className="flex justify-end w-full">
        <div
          className="flex items-center justify-center w-10 h-10 p-2 rounded-full hover:bg-opacity-10 bg-blue-50 bg-opacity-20"
          onClick={cerrar}
        >
          <CloseIcon></CloseIcon>
        </div>
      </div>

      <div className="flex  justify-center   gap-5">
        <div className="p-2 bg-black bg-opacity-20 flex justify-normal items-center rounded-full">
          <img
            className="w-32 h-32 lg:w-32 lg:h-32 rounded-full  "
            src={hamburger.src}
            alt=""
          />
        </div>
        <div className="">
          <span className="font-bold">{hamburger.name}</span>
          <p className="text-white text-opacity-50 lg:w-96">
            {hamburger.description}
          </p>
          <span className="text-[#FF7A21]">
            Precio: ${hamburger.price.toLocaleString()}{" "}
          </span>
        </div>
      </div>
      <div className="flex  w-full   flex-col items-center justify-center ">
        <div className="flex justify-center">
          <div className="flex justify-between p-2 w-96 lg:p-0">
            <span className=" lg:ml-2">Adiciones</span>
            <span className="bg-[#FF7A21] lg:mr-2 mr-0 rounded-full text-[12px] p-2 flex items-center  justify-center">
              Opcional
            </span>
          </div>
        </div>
        <div className="mt-2 lg:w-96 mg:w-96  w-full overflow-y-auto scroll-add h-44">
          {adiitions.map((adicion, i) => (
            <div
              key={i}
              className="flex gap-2 p-2 lg:ml-2 ml-3 mr-1 mt-2 bg-white rounded-lg bg-opacity-10  "
            >
              <div className="flex w-full gap-2">
                {" "}
                <div className="flex items-center justify-center p-1 bg-white rounded-full bg-opacity-15 w-14 h-14">
                  <img
                    className="rounded-full "
                    src="https://img.freepik.com/fotos-premium/contenedor-amarillo-papas-fritas-cara-cara-sonriente_913665-3058.jpg"
                    alt=""
                  />
                </div>
                <span>
                  {adicion.name}
                  <br />${adicion.pirce.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div
                  className="p-2  h-6 w-6 flex justify-center items-center rounded-full cursor-pointer bg-[#FF7A21] hover:bg-yellow-600 transition duration-300 shadow-md active:bg-yellow-700 "
                  onClick={() => modificarCantidadAdicion(i, "decrementar")}
                >
                  -
                </div>
                <div className="">{adiciones[i].cantidad}</div>
                <div
                  className="p-2 h-6 w-6 cursor-pointer flex justify-center items-center  rounded-full bg-[#FF7A21] hover:bg-yellow-600 transition duration-300 shadow-md active:bg-yellow-700"
                  onClick={() => modificarCantidadAdicion(i, "incrementar")}
                >
                  +
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center  mt-4">
          <div className="flex justify-between w-96">
            <span className="ml-2">Observaciones</span>
            <span className="bg-[#FF7A21] rounded-full text-[12px] p-2 flex items-center justify-center mr-2">
              Opcional
            </span>
          </div>
        </div>
      </div>

      <form className="max-w-sm mx-auto mt-4 flex justify-center items-center">
        <textarea
          id="message"
          rows="4"
          className="block p-2.5 ml-2 w-full mr-2 text-sm  bg-[#181A1B] rounded-lg border border-white focus:ring-blue-500 focus:border-blue-500  dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Observaciones"
          onChange={(e) => setObservaciones(e.target.value)}
        ></textarea>
      </form>
      <div className="flex justify-center">
        <div className="flex justify-between mt-4 w-96">
          <div className="flex items-center justify-center ml-2  p-2 bg-white rounded-full bg-opacity-5 gap-7">
            <div
              className="p-2 h-7 w-7 flex justify-center items-center rounded-full cursor-pointer bg-[#FF7A21] hover:bg-yellow-600 transition duration-300 shadow-md active:bg-yellow-700"
              onClick={disminuirBurger}
            >
              -
            </div>
            <div className=""> {cantidad}</div>
            <div
              className="p-2 h-7 w-7 cursor-pointer flex justify-center items-center  rounded-full bg-[#FF7A21] hover:bg-yellow-600 transition duration-300 shadow-md active:bg-yellow-700"
              onClick={aumentarBurger}
            >
              +
            </div>
          </div>
          <button
            className="p-2 bg-[#FF7A21] rounded-full hover:bg-yellow-600 transition duration-300 mr-2 shadow-md active:bg-yellow-700"
            onClick={agregar}
          >
            Agregar ${calcularTotal().toLocaleString()}{" "}
          </button>
        </div>
      </div>
    </div>
  );
}
