
import { Check, Clock, Truck, CalendarCheck } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Clock,
    title: "Same Day Delivery",
    description:
      "Fresh milk delivered to your doorstep within hours of milking",
  },
  {
    icon: Truck,
    title: "Local Sources",
    description:
      "Partnered with local farms to ensure the freshest dairy products",
  },
  {
    icon: Check,
    title: "Quality Guaranteed",
    description:
      "Our products undergo rigorous quality checks before delivery",
  },
  {
    icon: CalendarCheck,
    title: "Flexible Scheduling",
    description:
      "Choose your delivery frequency and easily modify your schedule",
  },
];

export const Features = () => {
  return (
    <section className="py-24 bg-white">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold mb-6 text-gray-900"
          >
            Why Choose Our Service?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            We combine traditional dairy farming with modern delivery technology to
            bring you the best possible service.
          </motion.p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="p-6 bg-cream-50 rounded-2xl hover:shadow-lg transition-shadow duration-300"
            >
              <feature.icon className="w-12 h-12 text-sage-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-gray-900">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
