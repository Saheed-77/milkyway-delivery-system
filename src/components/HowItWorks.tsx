
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Choose Your Products",
    description:
      "Select from our wide range of fresh dairy products and create your order.",
  },
  {
    number: "02",
    title: "Set Your Schedule",
    description:
      "Pick your preferred delivery frequency and time slots that work for you.",
  },
  {
    number: "03",
    title: "Receive Fresh Delivery",
    description:
      "Your fresh dairy products will be delivered right to your doorstep.",
  },
];

export const HowItWorks = () => {
  return (
    <section className="py-24 bg-sage-50">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold mb-6 text-gray-900"
          >
            How It Works
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            Getting started with our delivery service is simple and straightforward.
          </motion.p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative p-8 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300"
            >
              <span className="absolute -top-6 left-8 text-7xl font-bold text-sage-200">
                {step.number}
              </span>
              <div className="relative">
                <h3 className="text-xl font-semibold mb-4 text-gray-900">
                  {step.title}
                </h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
