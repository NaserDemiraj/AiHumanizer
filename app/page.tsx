import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Features from "./components/Features";
import RewriteModes from "./components/RewriteModes";
import HowItWorks from "./components/HowItWorks";
import LiveEditor from "./components/LiveEditor";
import Dashboard from "./components/Dashboard";
import Pricing from "./components/Pricing";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import CTA from "./components/CTA";
import Footer from "./components/Footer";
import "./page.css";

export default function Home() {
  return (
    <div className="hf-page">
      <Nav />
      <Hero />
      <Features />
      <RewriteModes />
      <HowItWorks />
      <LiveEditor />
      <Dashboard />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
