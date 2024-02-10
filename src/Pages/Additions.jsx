/* eslint-disable react/prop-types */
import CloseIcon from "@mui/icons-material/Close";
import {  useState } from "react";
// eslint-disable-next-line react/prop-types
export default function Additions({ cerrar, hamburger }) {
  const [cantidad, setCantidad] = useState(1);
  // const [totalBurger, setTotalBurger] = useState(0);
  const adiitions = [
    {
      name: "papas fritas",
      pirce: 10000,
      cantidad: 0,
    },
    {
      name: "Extra queso",
      pirce: 5000,
      cantidad: 0,
    },
    {
      name: "Carne de gato",
      pirce: 50000,
      cantidad: 0,
    },
  ];
  const aumentarBurger = () => {
    setCantidad(cantidad + 1);

    // setTotalBurger(total + hamburger.price);
    calcular();
  };
  const disminuirBurger = () => {
    if (cantidad > 1) {
      setCantidad(cantidad - 1);
      // setTotalBurger(total - hamburger.price);
    }
    calcular();
  };

  const [adiciones, setAdiciones] = useState(adiitions);
  const [total, setTotal] = useState(0);

  const calcular = () => {
    // Calculate the total price of all additions
    const totalOrden = adiciones.reduce((acc, adi) => {
      const subtotal = adi.cantidad * adi.pirce; // typo: should be 'price', not 'pirce'
      console.log("sub", subtotal);
      return acc + subtotal;
    }, 0);
    console.log("Total:", totalOrden);
    setTotal(totalOrden );
  };

  const aumentar = (adi, pos) => {
    console.log("POS", pos);
    const existingAdiIndex = adiciones.findIndex(
      (item) => item.name === adi.name
    );
    if (existingAdiIndex !== -1) {
      adiciones[existingAdiIndex].cantidad += 1;
      setAdiciones([...adiciones]);
      console.log(
        `Quantity increased for ${adi.name}: ${adiciones[existingAdiIndex].cantidad}`
      );
    } else {
      adiciones[pos].cantidad += 1;
      setAdiciones([...adiciones, adiciones[pos]]);
    }
    calcular();
  };

  const disminuir = (pos) => {
    if (adiciones[pos].cantidad > 0) {
      adiciones[pos].cantidad -= 1;
      setAdiciones([...adiciones, adiciones[pos]]);
    }
    calcular();
  };
  console.log("list", adiciones);

  return (
    <div className=" h-screen w-screen ">
      <div className="w-full flex justify-end">
        <div
          className="rounded-full flex justify-center items-center p-2 h-10 w-10 hover:bg-opacity-10 bg-blue-50 bg-opacity-20"
          onClick={cerrar}
        >
          <CloseIcon></CloseIcon>
        </div>
      </div>

      <div className="flex justify-center">
        <img
          className="lg:w-42 w-32 lg:h-auto h-32"
          src={hamburger.src}
          alt=""
        />
        <div className="">
          <span className="font-bold">{hamburger.name}</span>
          <p className="lg:w-96  text-white text-opacity-50">
            {hamburger.description}
          </p>
          <span className="text-[#FF7A21]">
            Precio: ${hamburger.price.toLocaleString()}{" "}
          </span>
        </div>
      </div>
      <div className="flex flex-col justify-center items-center ">
        <div className="flex justify-center">
          <div className="flex w-96 justify-between lg:p-0 p-2">
            <span>Adiciones</span>
            <span className="bg-[#FF7A21] rounded-lg text-[12px] p-2 flex items-center justify-center">
              Opcional
            </span>
          </div>
        </div>
        <div className="scroll-add overflow-y-auto mt-2 h-44">
          {adiitions.map((adicion, i) => (
            <div
              key={i}
              className="mt-2 bg-white bg-opacity-10 p-2  gap-2 w-96 rounded-lg flex "
            >
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
                  {adicion.name}
                  <br />${adicion.pirce.toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2 justify-center items-center">
                <div
                  className="p-2  h-6 w-6 flex justify-center items-center rounded-full cursor-pointer bg-[#FF7A21] "
                  onClick={() => disminuir(i)}
                >
                  -
                </div>
                <div className="">{adiciones[i].cantidad}</div>
                <div
                  className="p-2 h-6 w-6 cursor-pointer flex justify-center items-center  rounded-full bg-[#FF7A21] "
                  onClick={() => aumentar(adicion, i)}
                >
                  +
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-4">
          <div className="flex w-96 justify-between">
            <span>Observaciones</span>
            <span className="bg-[#FF7A21] rounded-lg text-[12px] p-2 flex items-center justify-center">
              Opcional
            </span>
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
              className="p-2 h-7 w-7 flex justify-center items-center rounded-full cursor-pointer bg-[#FF7A21] "
              onClick={disminuirBurger}
            >
              -
            </div>
            <div className="">{cantidad}</div>
            <div
              className="p-2 h-7 w-7 cursor-pointer flex justify-center items-center  rounded-full bg-[#FF7A21] "
              onClick={aumentarBurger}
            >
              +
            </div>
          </div>
          <button className="p-2 bg-[#FF7A21] rounded-full">
            Agregar ${(total + hamburger.price).toLocaleString()}{" "}
          </button>
        </div>
      </div>
    </div>
  );
}
